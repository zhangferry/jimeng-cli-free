#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$SKILL_DIR/config.json"
INFO_FILE="$SKILL_DIR/info.json"
OUTPUT_DIR="$SKILL_DIR/output"
DOWNLOADS_DIR="$SKILL_DIR/downloads"
VENDOR_DIR="$SKILL_DIR/vendor"
TMP_DIR="$SKILL_DIR/tmp"
OPENCLI_VENDOR_REPO_DIR="$VENDOR_DIR/OpenCLI"
OPENCLI_VENDOR_MAIN_JS="$OPENCLI_VENDOR_REPO_DIR/dist/src/main.js"
OPENCLI_VENDOR_PACKAGE_JSON="$OPENCLI_VENDOR_REPO_DIR/package.json"
RUNTIME_CACHE_DIR="$DOWNLOADS_DIR/runtime-cache"
OPENCLI_SANDBOX_HOME="$SKILL_DIR/.runtime-home"

python_json_get() {
  local file="$1"
  local key="$2"
  python3 - "$file" "$key" <<'PY'
import json, sys
path = sys.argv[2].split(".")
with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)
cur = data
for part in path:
    if isinstance(cur, dict):
        cur = cur.get(part)
    else:
        cur = None
        break
if cur is None:
    print("")
elif isinstance(cur, bool):
    print("true" if cur else "false")
else:
    print(cur)
PY
}

python_json_set() {
  local file="$1"
  local key="$2"
  local value="$3"
  python3 - "$file" "$key" "$value" <<'PY'
import json, sys
file_path, dotted_key, raw_value = sys.argv[1:4]
with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)
parts = dotted_key.split(".")
cur = data
for part in parts[:-1]:
    cur = cur.setdefault(part, {})
if raw_value == "__BOOL_TRUE__":
    value = True
elif raw_value == "__BOOL_FALSE__":
    value = False
elif raw_value == "__NULL__":
    value = None
else:
    value = raw_value
cur[parts[-1]] = value
with open(file_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")
PY
}

set_info_bool() {
  local key="$1"
  local bool_value="$2"
  if [[ "$bool_value" == "true" ]]; then
    python_json_set "$INFO_FILE" "$key" "__BOOL_TRUE__"
  else
    python_json_set "$INFO_FILE" "$key" "__BOOL_FALSE__"
  fi
}

now_iso() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

config_get() {
  python_json_get "$CONFIG_FILE" "$1"
}

info_get() {
  python_json_get "$INFO_FILE" "$1"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "缺少命令：$cmd" >&2
    exit 1
  fi
}

resolve_opencli_package_root() {
  local opencli_bin
  opencli_bin="$(command -v opencli || true)"
  if [[ -z "$opencli_bin" ]]; then
    return 1
  fi
  python3 - "$opencli_bin" <<'PY'
import os, sys
real = os.path.realpath(sys.argv[1])
print(os.path.abspath(os.path.join(real, "..", "..", "..")))
PY
}

skill_opencli_ready() {
  [[ -f "$OPENCLI_VENDOR_MAIN_JS" && -d "$OPENCLI_VENDOR_REPO_DIR/node_modules" ]]
}

skill_opencli_version() {
  if [[ -f "$OPENCLI_VENDOR_PACKAGE_JSON" ]]; then
    python3 - "$OPENCLI_VENDOR_PACKAGE_JSON" <<'PY'
import json, sys
with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)
print(data.get("version", ""))
PY
  fi
}

log() {
  printf '[jimeng-cli-free] %s\n' "$*" >&2
}

sips_format_for_output() {
  case "$1" in
    jpg) printf 'jpeg\n' ;;
    *) printf '%s\n' "$1" ;;
  esac
}
