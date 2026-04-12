#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

require_cmd cp

PATCHED_BG_JS="$SKILL_DIR/overrides/extension/background.js"
UNPACK_DIR="$DOWNLOADS_DIR/opencli-extension/unpacked"
TARGET_BG_JS="$UNPACK_DIR/dist/background.js"

if [[ ! -f "$PATCHED_BG_JS" ]]; then
  echo "未找到扩展补丁源文件：$PATCHED_BG_JS" >&2
  exit 1
fi

if [[ ! -d "$UNPACK_DIR" ]]; then
  log "浏览器插件尚未解压，跳过扩展后台化补丁。"
  exit 0
fi

mkdir -p "$(dirname "$TARGET_BG_JS")"
cp "$PATCHED_BG_JS" "$TARGET_BG_JS"
log "已应用浏览器插件后台化补丁：$TARGET_BG_JS"
