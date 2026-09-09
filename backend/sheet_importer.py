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
import re
import subprocess
import sys
import tempfile
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

_PDF_TO_PX = 300 / 72.0  # render at 300 DPI

# PZO2101 form geometry in PDF points. NOTE: PZO2101 is the 2e-layout form
# (Ancestry/Heritage, Hero Points, Class DC). It is the sheet the party's scans
# are physically written on, so the OCR reads this layout, but the draft maps
# onto the shared ruleset contract keys (hp/ac/initiative/abilities/saves).
# The scan's handwritten values land on a fixed 1e-style grid inside this form:
# ability labels and values sit in a left column, HP/AC/init on the mid rows.
_ABILITY_ROWS = ["str", "dex", "con", "int", "wis", "cha"]
_ABILITY_ANCHORS = {"str": "STR", "dex": "DEX", "con": "CON", "int": "INT", "wis": "WIS", "cha": "CHA"}

# Section regions (PDF points) on PZO2101 page 1.
_SECTIONS = {
    "name": (20, 30, 560, 70),
    "abilities": (20, 100, 200, 230),   # ability scores; WIS/CHA sit low in the block
    "vitals": (150, 95, 330, 135),      # HP row (and initiative header band)
    "initiative": (150, 190, 330, 220), # initiative total row
    "defenses": (15, 218, 330, 260),    # AC / touch / flat-footed band
    "saves": (15, 270, 330, 330),
    "bab": (20, 325, 330, 400),         # base attack bonus / CMB / CMD
    "speed": (300, 100, 560, 135),
    "skills": (300, 150, 590, 610),
}

# Value-column windows (PDF points) within a section row: a value counts if its
# box center-x falls in this range. Tuned from the acceptance scan (PZO2101).
_ABILITY_VALUE_X = (70, 95)    # score cell right of the ability label
_ABILITY_MOD_X = (98, 118)     # ability modifier cell
_HP_VALUE_X = (235, 265)       # HP total / wounds value
_INIT_VALUE_X = (238, 258)     # initiative total
_AC_VALUE_X = (72, 92)         # AC total (leftmost number on the AC row)
_TOUCH_VALUE_X = (72, 92)      # touch AC total (same column as AC, lower row)
_FLAT_VALUE_X = (152, 175)     # flat-footed AC total (right of its label)
_SAVE_VALUE_X = (108, 126)     # save TOTAL column (leftmost numeric on the row)
_BAB_VALUE_X = (135, 150)      # base attack bonus
_CMB_VALUE_X = (135, 150)      # CMB total
_SPEED_VALUE_X = (350, 385)    # base speed value

# Skill rows are located by their printed name anchors; the total is the
# leftmost numeric in the total column on that row. Each entry maps the sheet
# key to (printed anchor label, ability) — self-contained because the OCR
# subprocess ships this module without the rules package.
_SKILLS = {
    "acrobatics": ("ACROBATICS", "DEX"), "appraise": ("APPRAISE", "INT"),
    "bluff": ("BLUFF", "CHA"), "climb": ("CLIMB", "STR"),
    "craft": ("CRAFT", "INT"), "diplomacy": ("DIPLOMACY", "CHA"),
    "disable_device": ("DISABLE DEVICE", "DEX"), "disguise": ("DISGUISE", "CHA"),
    "escape_artist": ("ESCAPE ARTIST", "DEX"), "fly": ("FLY", "DEX"),
    "heal": ("HEAL", "WIS"), "intimidate": ("INTIMIDATE", "CHA"),
    "knowledge_arcana": ("KNOWLEDGE (ARCANA)", "INT"),
    "linguistics": ("LINGUISTICS", "INT"), "perception": ("PERCEPTION", "WIS"),
    "perform": ("PERFORM", "CHA"), "profession": ("PROFESSION", "WIS"),
    "ride": ("RIDE", "DEX"), "sense_motive": ("SENSE MOTIVE", "WIS"),
    "sleight_of_hand": ("SLEIGHT OF HAND", "DEX"), "spellcraft": ("SPELLCRAFT", "INT"),
    "stealth": ("STEALTH", "DEX"), "survival": ("SURVIVAL", "WIS"),
    "swim": ("SWIM", "STR"), "use_magic_device": ("USE MAGIC DEVICE", "CHA"),
}
_SKILL_TOTAL_X = (428, 450)   # skill total column

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
            page = document[0]
            pixmap = page.get_pixmap(dpi=300)
            image = Image.open(BytesIO(pixmap.tobytes("png"))).convert("RGB")
            # Scans are captured at the paper's physical size, not the form's
            # native 603x783 pt grid (e.g. the acceptance scan is ~830 pt tall).
            # Normalize detections onto the template frame so the section
            # geometry derived from the vector template applies to any scan.
            x_scale = 603.0 / page.rect.width
            y_scale = 783.0 / page.rect.height
        finally:
            document.close()

        # One full-page detection+recognition pass, then slice the detections
        # into named sections by coordinate. A single pass is both richer (the
        # detector localizes far more text on a full page than on tight crops)
        # and faster than one engine call per section.
        page_dets = self._detect_full(image)
        for d in page_dets:
            d["cx"] *= x_scale
            d["cy"] *= y_scale
        detections = {
            name: [d for d in page_dets if _in_region(d, region)]
            for name, region in _SECTIONS.items()
        }

        return self._build_draft(detections)

    # ---- section OCR ----

    def _detect_full(self, image: Any) -> List[Dict[str, Any]]:
        """Run det+rec on the whole page; return detections in PDF points."""
        results = self._engine().predict(_to_png_path(image))
        found = []
        for r in results:
            for rbox, text, score in zip(r.get("rec_boxes", []), r.get("rec_texts", []), r.get("rec_scores", [])):
                found.append({
                    "text": str(text),
                    "score": float(score),
                    # center in PDF points, relative to the page
                    "cx": (float(rbox[0]) + float(rbox[2])) / 2 / _PDF_TO_PX,
                    "cy": (float(rbox[1]) + float(rbox[3])) / 2 / _PDF_TO_PX,
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
    def _find_anchor_fuzzy(detections: List[Dict[str, Any]], label: str, max_dist: int = 2) -> Optional[Dict[str, Any]]:
        """Exact anchor match, else nearest edit-distance match (OCR label noise)."""
        hit = SheetImporter._find_anchor(detections, label)
        if hit is not None:
            return hit
        label = label.upper()
        best, best_dist = None, max_dist + 1
        for d in detections:
            dist = _edit_distance(d["text"].strip().upper().strip(".,:;*"), label)
            if dist < best_dist:
                best, best_dist = d, dist
        return best if best_dist <= max_dist else None

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
            # within one value cell; a wider gap means a separate cell (e.g.
            # the save BASE column next to TOTAL — merging those stitched 8+7
            # into 87 on the acceptance scan)
            if d["cx"] - clusters[-1][-1]["cx"] <= 10:
                clusters[-1].append(d)
            else:
                clusters.append([d])
        best = None
        for cluster in clusters:
            # Join the cluster's text and parse the leading signed integer.
            joined = "".join(d["text"] for d in cluster)
            value = _parse_number(joined)
            if value is None:
                # fallback: keep only digits across the cluster
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

        # character name: the topmost confident handwritten line in the name
        # band (the class line sits below it; printed labels are excluded by
        # the fuzzy label filter below).
        name_dets = [
            d for d in det["name"]
            if len(d["text"].strip()) >= 3 and d["score"] >= 0.6
        ]
        name_dets = [
            d for d in name_dets
            if _edit_distance(d["text"].strip().upper(), "CHARACTER NAME") > 2
            and _edit_distance(d["text"].strip().upper(), "PATHFINDER") > 2
        ]
        if name_dets:
            name_dets.sort(key=lambda d: d["cy"])
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
            hit = self._value_on_row(det["abilities"], anchor, _ABILITY_VALUE_X, y_tol=8.0)
            if hit is None:
                warnings.append(f"Could not read {ability.upper()}")
                continue
            values[f"abilities.{ability}"] = hit["value"]
            fields.append({"key": f"abilities.{ability}", "label": ability.upper(), "value": hit["value"], "raw": hit["raw"], "confidence": round(hit["score"] * 100)})

        # HP total
        hp_anchor = self._find_anchor(det["vitals"], "HP")
        hp_hit = self._value_on_row(det["vitals"], hp_anchor, _HP_VALUE_X, y_tol=10.0) if hp_anchor else None
        if hp_hit is not None:
            values["hp.total"] = hp_hit["value"]
            fields.append({"key": "hp.total", "label": "HP Total", "value": hp_hit["value"], "raw": hp_hit["raw"], "confidence": round(hp_hit["score"] * 100)})
        else:
            warnings.append("Could not read HP Total")

        # initiative (own band; the label OCRs garbled so use fuzzy anchor)
        init_anchor = self._find_anchor_fuzzy(det["initiative"], "INITIATIVE")
        init_hit = self._value_on_row(det["initiative"], init_anchor, _INIT_VALUE_X, y_tol=8.0) if init_anchor else None
        if init_hit is not None:
            values["initiative.bonus"] = init_hit["value"]
            fields.append({"key": "initiative.bonus", "label": "Initiative", "value": init_hit["value"], "raw": init_hit["raw"], "confidence": round(init_hit["score"] * 100)})
        else:
            warnings.append("Could not read Initiative")

        # AC / touch / flat-footed. The AC label OCRs to a garbled token (e.g.
        # "VAC"), so anchor on the value-row y-position of the defenses band
        # instead of the label: AC is the first value row, TOUCH below it.
        for key, label, anchor_label, window, tol in (
            ("defenses.ac", "Armor Class", "AC", _AC_VALUE_X, 5.0),
            ("defenses.touch_ac", "Touch AC", "TOUCH", _TOUCH_VALUE_X, 5.0),
            ("defenses.flat_footed_ac", "Flat-Footed AC", "FLAT-FOOTED", _FLAT_VALUE_X, 6.0),
        ):
            anchor = self._find_anchor_fuzzy(det["defenses"], anchor_label)
            hit = self._value_on_row(det["defenses"], anchor, window, y_tol=tol) if anchor else None
            if hit is not None:
                values[key] = hit["value"]
                fields.append({"key": key, "label": label, "value": hit["value"], "raw": hit["raw"], "confidence": round(hit["score"] * 100)})
            else:
                warnings.append(f"Could not read {label}")

        # base speed (the form's speed block; "SPEED"/"BASE SPEED" header)
        speed_anchor = self._find_anchor_fuzzy(det["speed"], "SPEED")
        speed_hit = self._value_on_row(det["speed"], speed_anchor, _SPEED_VALUE_X, y_tol=10.0) if speed_anchor else None
        if speed_hit is not None:
            values["movement.base_speed"] = speed_hit["value"]
            fields.append({"key": "movement.base_speed", "label": "Speed", "value": speed_hit["value"], "raw": speed_hit["raw"], "confidence": round(speed_hit["score"] * 100)})
        else:
            warnings.append("Could not read Speed")

        # saves (TOTAL column on each save row; labels OCR garbled)
        for key, label, anchor_label in (
            ("saves.fort", "Fortitude", "FORTITUDE"),
            ("saves.ref", "Reflex", "REFLEX"),
            ("saves.will", "Will", "WILL"),
        ):
            anchor = self._find_anchor_fuzzy(det["saves"], anchor_label)
            hit = self._value_on_row(det["saves"], anchor, _SAVE_VALUE_X, y_tol=8.0) if anchor else None
            if hit is None:
                warnings.append(f"Could not read {label}")
                continue
            values[key] = hit["value"]

        # base attack bonus and CMB
        bab_anchor = self._find_anchor_fuzzy(det["bab"], "BASE ATTACK BONUS")
        bab_hit = self._value_on_row(det["bab"], bab_anchor, _BAB_VALUE_X, y_tol=20.0) if bab_anchor else None
        if bab_hit is not None:
            values["combat.base_attack_bonus"] = bab_hit["value"]
            fields.append({"key": "combat.base_attack_bonus", "label": "Base Attack Bonus", "value": bab_hit["value"], "raw": bab_hit["raw"], "confidence": round(bab_hit["score"] * 100)})
        else:
            warnings.append("Could not read Base Attack Bonus")
        cmb_anchor = self._find_anchor(det["bab"], "CMB")
        # CMB/CMD totals share a column; CMB's value sits just right of its label row
        cmb_hit = self._value_on_row(det["bab"], cmb_anchor, _CMB_VALUE_X, y_tol=4.0) if cmb_anchor else None
        if cmb_hit is not None:
            values["combat.cmb"] = cmb_hit["value"]
            fields.append({"key": "combat.cmb", "label": "CMB", "value": cmb_hit["value"], "raw": cmb_hit["raw"], "confidence": round(cmb_hit["score"] * 100)})
        else:
            warnings.append("Could not read CMB")
        cmd_anchor = self._find_anchor(det["bab"], "CMD")
        cmd_hit = self._value_on_row(det["bab"], cmd_anchor, _CMB_VALUE_X, y_tol=4.0) if cmd_anchor else None
        if cmd_hit is not None:
            values["combat.cmd"] = cmd_hit["value"]
            fields.append({"key": "combat.cmd", "label": "CMD", "value": cmd_hit["value"], "raw": cmd_hit["raw"], "confidence": round(cmd_hit["score"] * 100)})
        else:
            warnings.append("Could not read CMD")

        # derive current HP from HP total (single source value)
        if "hp.total" in values:
            for key, label in (("hp.current", "Current HP"), ("hp.max", "Max HP")):
                fields.append({"key": key, "label": label, "value": values["hp.total"], "raw": str(values["hp.total"]), "derived": True})

        # skills (TOTAL column on each skill row; names OCR garbled, fuzzy match)
        skills = []
        for key, (anchor_label, ability) in _SKILLS.items():
            anchor = self._find_anchor_fuzzy(det["skills"], anchor_label, max_dist=3)
            if anchor is None:
                continue
            # the value sits on the printed label's line but its baseline runs
            # a couple points high; bias the row center up so the NEXT skill's
            # value (8+ pt below) is never in range
            row_anchor = {**anchor, "cy": anchor["cy"] - 2.5}
            hit = self._value_on_row(det["skills"], row_anchor, _SKILL_TOTAL_X, y_tol=4.5)
            if hit is not None:
                skills.append({
                    "key": key,
                    "name": key.replace("_", " ").title(),
                    "ability": ability,
                    "total": hit["value"],
                    "score": hit["score"],
                    "raw": hit["raw"],
                })
        if skills:
            fields.append({"key": "skills", "label": "Skills", "value": skills, "raw": "", "confidence": 0})

        # assemble saves collection (1e sheet stores saves as a collection)
        saves = []
        for key, name, ability in (("saves.fort", "Fortitude", "CON"), ("saves.ref", "Reflex", "DEX"), ("saves.will", "Will", "WIS")):
            if key in values:
                saves.append({"name": name, "ability": ability, "total": values[key], "base": 0, "ability_modifier": 0, "magic": 0, "misc": 0, "temporary": 0})
        if saves:
            fields.append({"key": "saves", "label": "Saving Throws", "value": saves, "raw": "", "confidence": 0})

        return {"fields": fields, "warnings": warnings, "ocr": {"available": True, "engine": "paddleocr"}}


def _in_region(detection: Dict[str, Any], region: Tuple[float, float, float, float]) -> bool:
    x0, y0, x1, y1 = region
    return x0 <= detection["cx"] <= x1 and y0 <= detection["cy"] <= y1


def _edit_distance(a: str, b: str) -> int:
    """Levenshtein distance between two strings (small inputs only)."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(cur[-1] + 1, prev[j] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _parse_number(text: str) -> Optional[int]:
    """Parse a handwritten integer from OCR text, tolerating stray symbols.

    Only the leading sign (if any) and the following digits are used; other
    characters OCR bleeds in from the form's texture (①, §, etc.) are dropped.
    """
    m = re.match(r"^\s*([+-]?)(\d+)", text.strip())
    if not m:
        return None
    try:
        return int(m.group(1) + m.group(2))
    except ValueError:
        return None


def _to_png_path(image: Any) -> str:
    """Write a PIL crop to a temp PNG for the OCR engine and return the path."""
    import tempfile
    handle = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    image.save(handle.name)
    handle.close()
    return handle.name
