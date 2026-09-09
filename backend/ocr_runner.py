"""Standalone OCR runner for character-sheet import.

Executed by the DEDICATED OCR environment (requirements-ocr.txt), never by
the backend's own interpreter:

    <ocr-python> ocr_runner.py <input.pdf> <output.json>

The backend (sheet_importer.import_pathfinder_1e) spawns this script as a
subprocess so the packaged app — whose frozen interpreter excludes the
PaddleOCR stack — can still OCR once the user has created the environment.
The result is written as a JSON FILE, not stdout, because PaddleOCR prints
model/progress noise to stdout:

    {"ok": true, "draft": {...}}   or   {"ok": false, "error": "..."}
"""

import json
import sys
from pathlib import Path

# The extraction code lives in the sibling sheet_importer.py; in the packaged
# app both ship as plain data files under sys._MEIPASS/ocr/.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sheet_importer import SheetImporter


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: ocr_runner.py <input.pdf> <output.json>", file=sys.stderr)
        return 2
    input_pdf, output_json = Path(sys.argv[1]), Path(sys.argv[2])
    try:
        draft = SheetImporter().extract_draft(input_pdf.read_bytes())
        payload = {"ok": True, "draft": draft}
    except Exception as exc:  # surfaced to the GM through the import route
        payload = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}
    output_json.write_text(json.dumps(payload))
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
