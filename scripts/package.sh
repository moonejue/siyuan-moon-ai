#!/bin/sh
set -eu
PLUGIN_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PLUGIN_DIR"
python3 - <<'PYTHON'
from pathlib import Path
import json
import zipfile
root = Path.cwd()
files = [Path(name) for name in ("plugin.json", "index.js", "index.css", "README.md", "README_zh_CN.md", "LICENSE", "icon.png", "preview.png")]
files += sorted(p for p in Path("assets").rglob("*") if p.is_file() and not p.name.startswith("."))
with zipfile.ZipFile("package.zip", "w", zipfile.ZIP_DEFLATED) as archive:
    for file in files:
        archive.write(file, file.as_posix())
with zipfile.ZipFile("package.zip") as archive:
    assert archive.testzip() is None
    for file in files:
        assert archive.read(file.as_posix()) == file.read_bytes(), str(file)
    version = json.loads(archive.read("plugin.json"))["version"]
print(f"Created and verified package.zip v{version}")
PYTHON
