#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$PROJECT_DIR/scripts/common.sh"

[[ "$(sips_format_for_output jpg)" == "jpeg" ]]
[[ "$(sips_format_for_output jpeg)" == "jpeg" ]]
[[ "$(sips_format_for_output png)" == "png" ]]
[[ "$(sips_format_for_output webp)" == "webp" ]]

echo "output format mapping test passed"
