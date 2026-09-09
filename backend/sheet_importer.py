"""Draft-only character-sheet import via OCR for supported form layouts.

Design: a scanned sheet PDF is rendered to an image, then PaddleOCR runs
detection+recognition over a small set of *section regions* (not per-field
crops). Within a section, a printed anchor label (STR, HP, FORTITUDE...) is
located and the recognized numeric value on the same row at the value column
is taken. This is robust to scan margins and skew because the detector finds
actual text positions rather than trusting fixed pixel boxes.

The OCR stack is NOT imported by the backend process. The PaddleOCR dependency
tree is heavy, fights FastAPI's anyio/pydantic pins, and the packaged backend
is a frozen binary that excludes it entirely. Instead the extraction itself
(extract_draft) runs in a dedicated user-created Python environment via
ocr_runner.py as a subprocess; import_pathfinder_1e is that subprocess
wrapper. Pins live in requirements-ocr.txt.

Ruleset-neutral core lives here; the PZO2101 (Pathfinder 1e) layout is the
registered form geometry. Values are returned as a reviewable draft — nothing
is persisted here.
"""

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

_PDF_TO_PX = 300 / 72.0  # render at 300 DPI

# PZO2101 form geometry in PDF points. Each section is (x0, y0, x1, y1) of the
# region to OCR, plus the anchor-label spec used to find each value's row.
_ABILITY_ROWS = ["str", "dex", "con", "int", "wis", "cha"]
_ABILITY_ANCHORS = {"str": "STR", "dex": "DEX", "con": "CON", "int": "INT", "wis": "WIS", "cha": "CHA"}

# Section regions (PDF points) on PZO2101 page 1.
_SECTIONS = {
    "name": (15, 78, 360, 105),
    "abilities": (15, 108, 210, 235),
    "vitals": (170, 100, 320, 260),
    "defenses": (15, 218, 320, 246),   # AC / touch / flat-footed band
    "saves": (15, 285, 320, 345),
}

# Value-column windows (PDF points) within a section row: a value counts if its
# box center-x falls in this range. Tuned from the acceptance scan.
_ABILITY_VALUE_X = (66, 100)   # score cell right of the label block
_HP_VALUE_X = (225, 265)
_INIT_VALUE_X = (235, 258)
_AC_VALUE_X = (70, 100)        # AC total is leftmost number on the AC row
_SAVE_VALUE_X = (104, 126)     # TOTAL column = leftmost numeric on the save row

# The first OCR run downloads the recognition models (~230 MB), so the
# subprocess timeout must cover a model download, not just inference.
_OCR_TIMEOUT_SECONDS = 900

# Pinned matched trio + render deps (see requirements-ocr.txt): other
# paddlepaddle/paddleocr/paddlex combinations hit a oneDNN executor bug or a
# paddlex API mismatch.
_OCR_PACKAGES = '"paddlepaddle==3.2.2" "paddleocr==3.3.0" "paddlex==3.3.0" "pymupdf==1.28.2" "Pillow>=10.0.0"'


def _paddle_importable() -> bool:
    """True when the PaddleOCR engine is importable by THIS interpreter."""
    try:
        return importlib.util.find_spec("paddleocr") is not None and importlib.util.find_spec("paddle") is not None
    except Exception:
        return False


def ocr_venv_dir() -> Path:
    """Directory of the dedicated OCR environment the user may create."""
    override = os.environ.get("GM_WORKBENCH_OCR_DIR")
    if override:
        return Path(override)
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    return base / "Game Masters Workbench" / "ocr-venv"


def ocr_python() -> Optional[str]:
    """Interpreter that can run ocr_runner.py, or None when OCR is unavailable.

    Order: explicit env override, then the current interpreter in development
    (the backend venv may legitimately carry the OCR stack), then the
    dedicated venv. The frozen packaged binary never has paddle importable,
    so installed builds always land on the dedicated venv.
    """
    override = os.environ.get("GM_WORKBENCH_OCR_PYTHON")
    if override and Path(override).is_file():
        return override
    if not getattr(sys, "frozen", False) and _paddle_importable():
        return sys.executable
    candidate = ocr_venv_dir() / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    return str(candidate) if candidate.is_file() else None


def ocr_runner_path() -> Optional[Path]:
    """The ocr_runner.py script on disk (ships as a data file in the package)."""
    if getattr(sys, "frozen", False):
        candidate = Path(sys._MEIPASS) / "ocr" / "ocr_runner.py"  # PyInstaller runtime dir
    else:
        candidate = Path(__file__).resolve().with_name("ocr_runner.py")
    return candidate if candidate.is_file() else None


class SheetImporter:
    """Extract a reviewable Actor draft from a PZO2101 Pathfinder 1e sheet PDF."""

    def __init__(self):
        self._ocr = None

    @staticmethod
    def ocr_available() -> bool:
        """True when an OCR interpreter and the runner script both exist."""
        return ocr_python() is not None and ocr_runner_path() is not None

    @staticmethod
    def ocr_install_guidance() -> Dict[str, Any]:
        """Exact commands to create the dedicated OCR environment (503 detail)."""
        venv = ocr_venv_dir()
        if sys.platform == "win32":
            commands = [f'py -m venv "{venv}"', f'"{venv}\\Scripts\\pip.exe" install {_OCR_PACKAGES}']
        else:
            commands = [f'python3 -m venv "{venv}"', f'"{venv}/bin/pip" install {_OCR_PACKAGES}']
        return {
            "message": "The OCR engine (PaddleOCR) is not installed on this computer",
            "venv_dir": str(venv),
            "commands": commands,
        }

    def _engine(self):
        if self._ocr is None:
            from paddleocr import PaddleOCR
            self._ocr = PaddleOCR(
                lang="en",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )
        return self._ocr

    def import_pathfinder_1e(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """OCR page one of a PZO2101 sheet via the OCR subprocess; draft only.

        The extraction itself runs in a dedicated Python environment (see
        ocr_python) executing ocr_runner.py, so neither the backend venv nor
        the frozen packaged binary needs the PaddleOCR stack.
        """
        python = ocr_python()
        runner = ocr_runner_path()
        if python is None or runner is None:
            raise RuntimeError("PaddleOCR is not available on this computer")
        with tempfile.TemporaryDirectory(prefix="gmw_ocr_") as tmp:
            input_pdf = Path(tmp) / "sheet.pdf"
            output_json = Path(tmp) / "result.json"
            input_pdf.write_bytes(pdf_bytes)
            try:
                process = subprocess.run(
                    [python, str(runner), str(input_pdf), str(output_json)],
                    capture_output=True,
                    text=True,
                    timeout=_OCR_TIMEOUT_SECONDS,
                )
            except subprocess.TimeoutExpired:
                raise RuntimeError(f"OCR did not finish within {_OCR_TIMEOUT_SECONDS} seconds")
            if not output_json.is_file():
                noise = (process.stderr or process.stdout or "").strip().splitlines()
                tail = " | ".join(noise[-3:]) or f"exit code {process.returncode}"
                raise RuntimeError(f"OCR runner produced no result: {tail}")
            payload = json.loads(output_json.read_text())
        if not payload.get("ok"):
            raise RuntimeError(payload.get("error", "OCR failed"))
        return payload["draft"]

    def extract_draft(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """The actual OCR work; runs inside the OCR environment via ocr_runner.py."""
        if not _paddle_importable():
            raise RuntimeError("PaddleOCR is not available on this computer")

        import pymupdf
        from PIL import Image

        document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        try:
            if not document.page_count:
                raise ValueError("The uploaded PDF has no pages")
            pixmap = document[0].get_pixmap(dpi=300)
            image = Image.open(BytesIO(pixmap.tobytes("png"))).convert("RGB")
        finally:
            document.close()

        detections = {}
        for name, region in _SECTIONS.items():
            detections[name] = self._detect(image, region)

        return self._build_draft(detections)

    # ---- section OCR ----

    def _detect(self, image: Any, region: Tuple[float, float, float, float]) -> List[Dict[str, Any]]:
        """Run det+rec on a section region; return detections in PDF points."""
        box = [round(v * _PDF_TO_PX) for v in region]
        crop = image.crop(box)
        results = self._engine().predict(_to_png_path(crop))
        found = []
        for r in results:
            for rbox, text, score in zip(r.get("rec_boxes", []), r.get("rec_texts", []), r.get("rec_scores", [])):
                found.append({
                    "text": str(text),
                    "score": float(score),
                    # center in PDF points, relative to the page
                    "cx": (float(rbox[0]) + float(rbox[2])) / 2 / _PDF_TO_PX + region[0],
                    "cy": (float(rbox[1]) + float(rbox[3])) / 2 / _PDF_TO_PX + region[1],
                })
        return found

    # ---- spatial mapping ----

    @staticmethod
    def _find_anchor(detections: List[Dict[str, Any]], label: str) -> Optional[Dict[str, Any]]:
        label = label.upper()
        best = None
        for d in detections:
            if d["text"].strip().upper().strip(".,:;*") == label:
                if best is None or d["score"] > best["score"]:
                    best = d
        return best

    @staticmethod
    def _value_on_row(detections, anchor, x_window, y_tol=6.0) -> Optional[Dict[str, Any]]:
        """Numeric value on the anchor's row whose center-x is in x_window.

        Adjacent numeric detections on the row (a two-digit value split by the
        detector, e.g. CHA 20 read as separate '2' and '0') are clustered into a
        single value before selection.
        """
        row = []
        for d in detections:
            if d is anchor:
                continue
            if abs(d["cy"] - anchor["cy"]) > y_tol:
                continue
            if not (x_window[0] <= d["cx"] <= x_window[1]):
                continue
            if _parse_number(d["text"]) is not None:
                row.append(d)
        if not row:
            return None
        # cluster detections that are horizontally adjacent (same logical number)
        row.sort(key=lambda d: d["cx"])
        clusters: List[List[Dict[str, Any]]] = [[row[0]]]
        for d in row[1:]:
            if d["cx"] - clusters[-1][-1]["cx"] <= 14:  # pts; within one value cell
                clusters[-1].append(d)
            else:
                clusters.append([d])
        best = None
        for cluster in clusters:
            digits = "".join("".join(c for c in d["text"] if c.isdigit()) for d in cluster)
            if not digits:
                continue
            value = int(digits)
            score = sum(d["score"] for d in cluster) / len(cluster)
            if best is None or score > best["score"]:
                best = {"value": value, "raw": "".join(d["text"] for d in cluster), "score": score}
        return best

    def _build_draft(self, det: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        fields: List[Dict[str, Any]] = []
        warnings: List[str] = []
        values: Dict[str, Any] = {}

        # character name: longest text detection in the name section
        name_dets = [d for d in det["name"] if len(d["text"].strip()) >= 2 and d["text"].strip().upper() not in ("CHARACTER", "NAME")]
        if name_dets:
            name_dets.sort(key=lambda d: -len(d["text"]))
            values["name"] = name_dets[0]["text"].strip()
            fields.append({"key": "name", "label": "Character Name", "value": values["name"], "raw": values["name"], "confidence": round(name_dets[0]["score"] * 100)})
        else:
            warnings.append("Could not read Character Name")

        # abilities
        for ability in _ABILITY_ROWS:
            anchor = self._find_anchor(det["abilities"], _ABILITY_ANCHORS[ability])
            if not anchor:
                warnings.append(f"Could not locate {ability.upper()} label")
                continue
            hit = self._value_on_row(det["abilities"], anchor, _ABILITY_VALUE_X)
            if hit is None:
                warnings.append(f"Could not read {ability.upper()}")
                continue
            values[f"abilities.{ability}"] = hit["value"]
            fields.append({"key": f"abilities.{ability}", "label": ability.upper(), "value": hit["value"], "raw": hit["raw"], "confidence": round(hit["score"] * 100)})

        # vitals
        for key, label, anchor_label, window in (
            ("hp.total", "HP Total", "HP", _HP_VALUE_X),
            ("initiative.bonus", "Initiative", "INITIATIVE", _INIT_VALUE_X),
        ):
            anchor = self._find_anchor(det["vitals"], anchor_label)
            hit = self._value_on_row(det["vitals"], anchor, window) if anchor else None
            if hit is None:
                warnings.append(f"Could not read {label}")
                continue
            values[key] = hit["value"]
            fields.append({"key": key, "label": label, "value": hit["value"], "raw": hit["raw"], "confidence": round(hit["score"] * 100)})

        # AC (leftmost numeric on the AC row in the defenses band)
        ac_anchor = self._find_anchor(det["defenses"], "AC")
        ac_hit = self._value_on_row(det["defenses"], ac_anchor, _AC_VALUE_X, y_tol=8.0) if ac_anchor else None
        if ac_hit is not None:
            values["defenses.ac"] = ac_hit["value"]
            fields.append({"key": "defenses.ac", "label": "Armor Class", "value": ac_hit["value"], "raw": ac_hit["raw"], "confidence": round(ac_hit["score"] * 100)})
        else:
            warnings.append("Could not read Armor Class")

        # saves (TOTAL column = leftmost numeric on each save row)
        for key, label, anchor_label in (
            ("saves.fort", "Fortitude", "FORTITUDE"),
            ("saves.ref", "Reflex", "REFLEX"),
            ("saves.will", "Will", "WILL"),
        ):
            anchor = self._find_anchor(det["saves"], anchor_label)
            hit = self._value_on_row(det["saves"], anchor, _SAVE_VALUE_X, y_tol=8.0) if anchor else None
            if hit is None:
                warnings.append(f"Could not read {label}")
                continue
            values[key] = hit["value"]

        # derive current HP from HP total (single source value)
        if "hp.total" in values:
            for key, label in (("hp.current", "Current HP"), ("hp.max", "Max HP")):
                fields.append({"key": key, "label": label, "value": values["hp.total"], "raw": str(values["hp.total"]), "derived": True})

        # assemble saves collection (1e sheet stores saves as a collection)
        saves = []
        for key, name, ability in (("saves.fort", "Fortitude", "CON"), ("saves.ref", "Reflex", "DEX"), ("saves.will", "Will", "WIS")):
            if key in values:
                saves.append({"name": name, "ability": ability, "total": values[key], "base": 0, "ability_modifier": 0, "magic": 0, "misc": 0, "temporary": 0})
        if saves:
            fields.append({"key": "saves", "label": "Saving Throws", "value": saves, "raw": "", "confidence": 0})

        return {"fields": fields, "warnings": warnings, "ocr": {"available": True, "engine": "paddleocr"}}


def _parse_number(text: str) -> Optional[int]:
    digits = "".join(c for c in text if c.isdigit() or c in "+-")
    if digits in {"", "+", "-"}:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def _to_png_path(image: Any) -> str:
    """Write a PIL crop to a temp PNG for the OCR engine and return the path."""
    import tempfile
    handle = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    image.save(handle.name)
    handle.close()
    return handle.name
