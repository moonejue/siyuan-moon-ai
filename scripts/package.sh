#!/bin/sh
set -eu

PLUGIN_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUTPUT_FILE="$PLUGIN_DIR/package.zip"

cd "$PLUGIN_DIR"
rm -f "$OUTPUT_FILE"
zip -qr "$OUTPUT_FILE" plugin.json index.js index.css README.md README_zh_CN.md LICENSE icon.png preview.png assets
printf '%s\n' "Created $OUTPUT_FILE"
