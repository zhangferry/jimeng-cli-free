#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

require_cmd node

if ! skill_opencli_ready; then
  echo "skill 私有 opencli runtime 尚未准备好，请先运行 sync_fork_patch.sh" >&2
  exit 1
fi

mkdir -p "$OPENCLI_SANDBOX_HOME"

LOCK_DIR="$OPENCLI_SANDBOX_HOME/jimeng-opencli.lock"
LOCK_HELD="false"

acquire_automation_lock() {
  local timeout_seconds="${JIMENG_OPENCLI_LOCK_TIMEOUT_SECONDS:-360}"
  local deadline=$((SECONDS + timeout_seconds))

  while ! mkdir "$LOCK_DIR" 2>/dev/null; do
    local owner_pid=""
    if [[ -f "$LOCK_DIR/pid" ]]; then
      read -r owner_pid <"$LOCK_DIR/pid" || true
    fi
    if [[ "$owner_pid" =~ ^[0-9]+$ ]] && ! kill -0 "$owner_pid" 2>/dev/null; then
      rm -f "$LOCK_DIR/pid"
      rmdir "$LOCK_DIR" 2>/dev/null || true
      continue
    fi
    if (( SECONDS >= deadline )); then
      echo "等待即梦浏览器会话超时（当前任务 PID: ${owner_pid}）" >&2
      exit 75
    fi
    sleep 0.2
  done

  printf '%s\n' "$$" >"$LOCK_DIR/pid"
  LOCK_HELD="true"
}

# Browser commands share the `site:jimeng` automation workspace.  The OpenCLI
# runtime closes it after a successful command, but older bridge runtimes can
# leave it behind when a command throws while collecting diagnostics.  Always
# send the idempotent cleanup command when this wrapper exits so failed retries
# cannot accumulate blank Chrome windows.
cleanup_automation_window() {
  curl --silent --show-error --fail --max-time 5 \
    -H 'X-OpenCLI: 1' \
    -H 'Content-Type: application/json' \
    --data '{"id":"jimeng-cli-free-cleanup","action":"close-window","workspace":"site:jimeng"}' \
    http://127.0.0.1:19825/command >/dev/null 2>&1 || true
}

cleanup_on_exit() {
  local status=$?
  cleanup_automation_window
  if [[ "$LOCK_HELD" == "true" ]]; then
    rm -f "$LOCK_DIR/pid"
    rmdir "$LOCK_DIR" 2>/dev/null || true
  fi
  return "$status"
}
trap cleanup_on_exit EXIT

acquire_automation_lock
env HOME="$OPENCLI_SANDBOX_HOME" node "$OPENCLI_VENDOR_MAIN_JS" "$@"
