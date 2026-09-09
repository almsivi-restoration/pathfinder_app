# PyInstaller spec for the Game Master's Workbench FastAPI backend.
# Build from the backend/ directory:
#   venv/bin/pyinstaller gm-workbench-backend.spec
# Output: backend/dist/gm-workbench-backend (picked up by electron-builder
# via extraResources in frontend/package.json).
#
# No data files are bundled: reference PDFs are user-supplied at runtime, and
# campaigns live under the per-user data directory (env vars set by Electron).

# PaddleOCR ships UNBUNDLED: the frozen interpreter excludes the whole OCR
# stack and the extraction runs as a SUBPROCESS under a dedicated user-created
# venv (backend/requirements-ocr.txt, sheet_importer.ocr_python). The imports
# in sheet_importer.py are lazy, but PyInstaller's analysis still follows them
# from main.py's top-level `from sheet_importer import SheetImporter` and would
# drag ~730MB of paddle + opencv + scipy into the binary. Exclude the whole OCR
# stack so the packaged backend stays lean; when the OCR venv is absent the
# import route answers 503 with the exact install commands.
_OCR_EXCLUDES = [
    'paddle', 'paddleocr', 'paddlex', 'paddlepaddle',
    'cv2', 'opencv', 'opencv_contrib_python', 'opencv-contrib-python',
    'scipy', 'sklearn', 'pandas', 'shapely', 'pyclipper',
    'matplotlib', 'networkx', 'aistudio_sdk', 'modelscope',
    'langchain', 'langchain_core', 'langchain_community', 'langchain_openai',
    'langchain_text_splitters', 'langsmith', 'openai', 'tiktoken', 'sentencepiece',
    'transformers', 'tokenizers', 'huggingface_hub', 'safetensors',
    'faiss', 'onnx', 'onnxruntime', 'torch', 'tensorflow',
]

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    # ocr_runner.py + sheet_importer.py ship as plain scripts (NOT frozen into
    # the binary) so the dedicated OCR venv's interpreter can run the actual
    # extraction as a subprocess from sys._MEIPASS/ocr/.
    datas=[('ocr_runner.py', 'ocr'), ('sheet_importer.py', 'ocr')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=_OCR_EXCLUDES,
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='gm-workbench-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
