#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROMPT=""
IMAGE=""
ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt) PROMPT="${2:-}"; shift 2 ;;
    --image|--reference) IMAGE="${2:-}"; shift 2 ;;
    --reference-url|--image-url) ARGS+=("$1" "${2:-}"); shift 2 ;;
    --clipboard) ARGS+=("$1"); shift ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac
done

if [[ -z "$IMAGE" ]]; then
  echo "--image 必填" >&2
  exit 1
fi

if [[ -z "$PROMPT" ]]; then
  echo "--prompt 必填" >&2
  exit 1
fi

exec bash "$SCRIPT_DIR/generate_image.sh" --prompt "$PROMPT" --reference "$IMAGE" --mode edit "${ARGS[@]}"
