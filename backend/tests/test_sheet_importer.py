"""Sheet-importer tests. Heavy OCR is skipped without the engine or the local
acceptance scan; spatial-mapping logic is unit-tested with synthetic detections."""

import shutil
import sys
from pathlib import Path

import pytest

import sheet_importer
from sheet_importer import SheetImporter, _parse_number

SCAN = Path(__file__).resolve().parent.parent.parent / "artifacts" / "local" / "character_sheet_importer" / "the_pitiless_jape_character_sheet.pdf"


def test_parse_number():
    assert _parse_number("+8") == 8
    assert _parse_number("45") == 45
    assert _parse_number("-1") == -1
    assert _parse_number("abc") is None
    assert _parse_number("") is None
    assert _parse_number("+") is None


def _det(text, cx, cy, score=0.9):
    return {"text": text, "score": score, "cx": cx, "cy": cy}


def test_value_on_row_picks_window_and_clusters_split_digits():
    # STR label at cx~43; the score '20' split into '2' and '0' in the value column.
    detections = [
        _det("STR", 43, 120),
        _det("2", 80, 120, 0.99),
        _det("0", 90, 120, 0.6),   # faint second digit, adjacent -> cluster to 20
        _det("99", 250, 120, 0.99),  # out of value window -> ignored
    ]
    anchor = SheetImporter._find_anchor(detections, "STR")
    hit = SheetImporter._value_on_row(detections, anchor, (60, 100))
    assert hit["value"] == 20


def test_value_on_row_ignores_other_rows():
    detections = [
        _det("DEX", 43, 140),
        _det("8", 80, 120),   # different row -> ignored
        _det("16", 80, 140),
    ]
    anchor = SheetImporter._find_anchor(detections, "DEX")
    hit = SheetImporter._value_on_row(detections, anchor, (60, 100))
    assert hit["value"] == 16


def test_value_on_row_returns_none_when_no_value():
    detections = [_det("CON", 43, 160)]
    anchor = SheetImporter._find_anchor(detections, "CON")
    assert SheetImporter._value_on_row(detections, anchor, (60, 100)) is None


@pytest.mark.skipif(not SCAN.is_file(), reason="local acceptance scan not present")
@pytest.mark.skipif(not SheetImporter.ocr_available(), reason="PaddleOCR not available")
def test_real_scan_extracts_core_fields():
    """Acceptance: the retraced real scan yields the core tracker-visible fields."""
    draft = SheetImporter().import_pathfinder_1e(SCAN.read_bytes())
    got = {f["key"]: f.get("value") for f in draft["fields"] if f["key"] != "saves"}

    # High-confidence fields the engine reads reliably on this scan.
    assert got["abilities.str"] == 8
    assert got["abilities.dex"] == 16
    assert got["abilities.con"] == 12
    assert got["abilities.int"] == 14
    assert got["abilities.wis"] == 10
    assert got["hp.total"] == 45
    # Derived current HP mirrors the total.
    assert got["hp.current"] == 45
    assert got["hp.max"] == 45

    saves = {s["name"]: s["total"] for s in next(f for f in draft["fields"] if f["key"] == "saves")["value"]}
    assert saves.get("Reflex") == 8

    # Known-faint fields surface as warnings or reviewable low values, never silently dropped.
    assert isinstance(draft["warnings"], list)


# ---- OCR subprocess wrapper ----


def test_ocr_python_env_override(monkeypatch, tmp_path):
    fake = tmp_path / "bin" / "python"
    fake.parent.mkdir()
    fake.touch()
    monkeypatch.setenv("GM_WORKBENCH_OCR_PYTHON", str(fake))
    assert sheet_importer.ocr_python() == str(fake)


def test_ocr_python_none_when_nothing_available(monkeypatch, tmp_path):
    monkeypatch.delenv("GM_WORKBENCH_OCR_PYTHON", raising=False)
    monkeypatch.setenv("GM_WORKBENCH_OCR_DIR", str(tmp_path / "missing-venv"))
    monkeypatch.setattr(sheet_importer, "_paddle_importable", lambda: False)
    assert sheet_importer.ocr_python() is None
    assert not SheetImporter.ocr_available()


def test_ocr_install_guidance_carries_commands(monkeypatch, tmp_path):
    monkeypatch.setenv("GM_WORKBENCH_OCR_DIR", str(tmp_path / "ocr-venv"))
    guidance = SheetImporter.ocr_install_guidance()
    assert str(tmp_path) in guidance["venv_dir"]
    assert len(guidance["commands"]) == 2
    assert "paddlepaddle==3.2.2" in guidance["commands"][1]


def test_import_without_engine_raises(monkeypatch):
    monkeypatch.setattr(sheet_importer, "ocr_python", lambda: None)
    with pytest.raises(RuntimeError, match="not available"):
        SheetImporter().import_pathfinder_1e(b"%PDF-1.4 fake")


def test_import_returns_runner_draft(monkeypatch, tmp_path):
    runner = tmp_path / "fake_runner.py"
    runner.write_text(
        "import json, sys\n"
        "from pathlib import Path\n"
        "Path(sys.argv[2]).write_text(json.dumps({'ok': True, 'draft': {'fields': [], 'warnings': ['w'], 'ocr': {}}}))\n"
    )
    monkeypatch.setattr(sheet_importer, "ocr_python", lambda: sys.executable)
    monkeypatch.setattr(sheet_importer, "ocr_runner_path", lambda: runner)
    draft = SheetImporter().import_pathfinder_1e(b"%PDF-1.4 fake")
    assert draft["warnings"] == ["w"]


def test_import_surfaces_runner_error(monkeypatch, tmp_path):
    runner = tmp_path / "fake_runner.py"
    runner.write_text(
        "import json, sys\n"
        "from pathlib import Path\n"
        "Path(sys.argv[2]).write_text(json.dumps({'ok': False, 'error': 'boom: engine exploded'}))\n"
    )
    monkeypatch.setattr(sheet_importer, "ocr_python", lambda: sys.executable)
    monkeypatch.setattr(sheet_importer, "ocr_runner_path", lambda: runner)
    with pytest.raises(RuntimeError, match="engine exploded"):
        SheetImporter().import_pathfinder_1e(b"%PDF-1.4 fake")


def test_import_runner_crash_without_result(monkeypatch, tmp_path):
    runner = tmp_path / "fake_runner.py"
    runner.write_text("import sys\nsys.stderr.write('Traceback: no module named paddleocr\\n')\nsys.exit(1)\n")
    monkeypatch.setattr(sheet_importer, "ocr_python", lambda: sys.executable)
    monkeypatch.setattr(sheet_importer, "ocr_runner_path", lambda: runner)
    with pytest.raises(RuntimeError, match="produced no result"):
        SheetImporter().import_pathfinder_1e(b"%PDF-1.4 fake")
