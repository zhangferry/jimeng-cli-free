#!/usr/bin/env bash
# workspace_cache.sh — 按任务标识（task_key）缓存即梦会话（workspace_id）。
# 目的：让同一个任务内的多次生图复用同一个即梦对话，避免「每张图一个对话」导致账号对话数爆炸。
# 依赖：common.sh（提供 SKILL_DIR、log、python_json_* 等运行时变量与工具）。
# 请在 source common.sh 之后再 source 本文件。

set -euo pipefail

# 缓存文件：{ "<task_key>": { "workspace_id": "...", "created_at": "...", "updated_at": "...", "count": N } }
WORKSPACE_CACHE_FILE="${SKILL_DIR:-.}/.workspace-cache.json"

# workspace_cache_get <task_key>
# 输出：命中的 workspace_id；未命中或出错时输出空。
workspace_cache_get() {
  local key="${1:-}"
  [[ -z "$key" || ! -f "$WORKSPACE_CACHE_FILE" ]] && return 0
  python3 - "$WORKSPACE_CACHE_FILE" "$key" <<'PY'
import json, sys
path, key = sys.argv[1], sys.argv[2]
try:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
except Exception:
    sys.exit(0)
entry = data.get(key) if isinstance(data, dict) else None
if isinstance(entry, dict) and entry.get("workspace_id"):
    print(str(entry["workspace_id"]).strip())
PY
}

# workspace_cache_set <task_key> <workspace_id>
# 记录或更新某个任务对应的 workspace_id，并累加复用次数。
workspace_cache_set() {
  local key="${1:-}"
  local ws="${2:-}"
  [[ -z "$key" || -z "$ws" ]] && return 0
  mkdir -p "$(dirname "$WORKSPACE_CACHE_FILE")"
  python3 - "$WORKSPACE_CACHE_FILE" "$key" "$ws" <<'PY'
import json, os, sys, datetime
path, key, ws = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
except Exception:
    data = {}
if not isinstance(data, dict):
    data = {}
now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
entry = data.get(key, {}) if isinstance(data.get(key), dict) else {}
entry.update({
    "workspace_id": ws,
    "updated_at": now,
    "count": int(entry.get("count", 0) or 0) + 1,
})
entry.setdefault("created_at", now)
data[key] = entry
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")
PY
}
