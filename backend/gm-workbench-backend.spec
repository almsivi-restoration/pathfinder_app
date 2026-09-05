# PyInstaller spec for the Game Master's Workbench FastAPI backend.
# Build from the backend/ directory:
#   venv/bin/pyinstaller gm-workbench-backend.spec
# Output: backend/dist/gm-workbench-backend (picked up by electron-builder
# via extraResources in frontend/package.json).
#
# No data files are bundled: reference PDFs are user-supplied at runtime, and
# campaigns live under the per-user data directory (env vars set by Electron).

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
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
