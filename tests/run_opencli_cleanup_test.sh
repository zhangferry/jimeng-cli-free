#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FAKE_BIN_DIR="$(mktemp -d)"
REQUEST_LOG="$FAKE_BIN_DIR/curl-request"
trap 'rm -rf "$FAKE_BIN_DIR"' EXIT

cat >"$FAKE_BIN_DIR/node" <<'NODE'
#!/usr/bin/env bash
exit 23
NODE
chmod +x "$FAKE_BIN_DIR/node"

cat >"$FAKE_BIN_DIR/curl" <<'CURL'
#!/usr/bin/env bash
printf '%s\n' "$*" >"$CURL_REQUEST_LOG"
CURL
chmod +x "$FAKE_BIN_DIR/curl"

set +e
PATH="$FAKE_BIN_DIR:$PATH" CURL_REQUEST_LOG="$REQUEST_LOG" \
  bash "$PROJECT_DIR/scripts/run_opencli.sh" jimeng generate test
status=$?
set -e

[[ "$status" -eq 23 ]] || {
  echo "expected wrapped OpenCLI exit status 23, got $status" >&2
  exit 1
}

rg -q '"action":"close-window"' "$REQUEST_LOG"
rg -q '"workspace":"site:jimeng"' "$REQUEST_LOG"

echo "run_opencli cleanup regression test passed"
