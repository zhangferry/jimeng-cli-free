#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FAKE_BIN_DIR="$(mktemp -d)"
EVENT_LOG="$FAKE_BIN_DIR/events"
trap 'rm -rf "$FAKE_BIN_DIR"' EXIT

cat >"$FAKE_BIN_DIR/node" <<'NODE'
#!/usr/bin/env bash
printf 'start %s\n' "$$" >>"$FAKE_NODE_EVENT_LOG"
sleep 1
printf 'end %s\n' "$$" >>"$FAKE_NODE_EVENT_LOG"
NODE
chmod +x "$FAKE_BIN_DIR/node"

cat >"$FAKE_BIN_DIR/curl" <<'CURL'
#!/usr/bin/env bash
exit 0
CURL
chmod +x "$FAKE_BIN_DIR/curl"

PATH="$FAKE_BIN_DIR:$PATH" FAKE_NODE_EVENT_LOG="$EVENT_LOG" \
  JIMENG_OPENCLI_LOCK_TIMEOUT_SECONDS=5 \
  bash "$PROJECT_DIR/scripts/run_opencli.sh" jimeng generate first &
first_pid=$!
PATH="$FAKE_BIN_DIR:$PATH" FAKE_NODE_EVENT_LOG="$EVENT_LOG" \
  JIMENG_OPENCLI_LOCK_TIMEOUT_SECONDS=5 \
  bash "$PROJECT_DIR/scripts/run_opencli.sh" jimeng generate second &
second_pid=$!

wait "$first_pid"
wait "$second_pid"

if ! awk '
  $1 == "start" { active += 1; if (active > 1) failed = 1 }
  $1 == "end" { active -= 1 }
  END { exit failed || NR != 4 || active != 0 }
' "$EVENT_LOG"; then
  sed -n '1,20p' "$EVENT_LOG" >&2
  exit 1
fi

echo "run_opencli serialization regression test passed"
