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

exec env HOME="$OPENCLI_SANDBOX_HOME" node "$OPENCLI_VENDOR_MAIN_JS" "$@"
