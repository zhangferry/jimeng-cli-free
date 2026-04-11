#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

require_cmd python3
require_cmd curl
require_cmd sips

RUN_OPENCLI="$SCRIPT_DIR/run_opencli.sh"

PROMPT=""
MODEL=""
ASPECT=""
WORKSPACE=""
OUTPUT_FORMAT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt) PROMPT="${2:-}"; shift 2 ;;
    --model) MODEL="${2:-}"; shift 2 ;;
    --aspect) ASPECT="${2:-}"; shift 2 ;;
    --workspace) WORKSPACE="${2:-}"; shift 2 ;;
    --format) OUTPUT_FORMAT="${2:-}"; shift 2 ;;
    *)
      echo "未知参数：$1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$PROMPT" ]]; then
  echo "--prompt 必填" >&2
  exit 1
fi

MODEL="${MODEL:-$(config_get default_model)}"
ASPECT="${ASPECT:-$(config_get default_aspect)}"
WORKSPACE="${WORKSPACE:-$(config_get default_workspace)}"
OUTPUT_FORMAT="${OUTPUT_FORMAT:-$(config_get default_output_format)}"
WAIT_SECONDS="$(config_get generate_wait_seconds)"
MAX_ATTEMPTS="$(config_get max_generate_attempts)"

case "$OUTPUT_FORMAT" in
  png|jpg|jpeg|webp) ;;
  *)
    echo "不支持的输出格式：$OUTPUT_FORMAT，支持 png/jpg/webp" >&2
    exit 1
    ;;
esac

bash "$SCRIPT_DIR/ensure_opencli_and_jimeng.sh"
bash "$SCRIPT_DIR/sync_fork_patch.sh"

attempt=1
success="false"
last_json=""
run_dir=""

while [[ "$attempt" -le "$MAX_ATTEMPTS" ]]; do
  ts="$(date +%Y%m%d-%H%M%S)"
  run_dir="$OUTPUT_DIR/$ts"
  mkdir -p "$run_dir"
  printf '%s\n' "$PROMPT" > "$run_dir/prompt.txt"

  log "第 $attempt 次调用 skill 私有 runtime 的 opencli jimeng generate"
  json_path="$run_dir/result.json"
  err_path="$run_dir/result.stderr.log"
  if OPENCLI_DIAGNOSTIC=1 bash "$RUN_OPENCLI" jimeng generate "$PROMPT" --model "$MODEL" --aspect "$ASPECT" --workspace "$WORKSPACE" --wait "$WAIT_SECONDS" -f json >"$json_path" 2>"$err_path"; then
    :
  fi

  last_json="$json_path"
  read_status_and_urls="$(python3 - "$json_path" <<'PY'
import json, sys
try:
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        data = json.load(f)
except Exception:
    print("parse_error")
    raise SystemExit
if not isinstance(data, list) or not data:
    print("invalid")
    raise SystemExit
item = data[0]
status = str(item.get("status", ""))
urls = [u for u in str(item.get("image_urls", "")).splitlines() if u.strip()]
print(status)
for u in urls:
    print(u)
PY
)"

  status="$(printf '%s\n' "$read_status_and_urls" | sed -n '1p')"
  urls=()
  while IFS= read -r line; do
    urls+=("$line")
  done < <(printf '%s\n' "$read_status_and_urls" | sed -n '2,$p')

  if [[ "$status" == "success" || "$status" == "pending" ]]; then
    if [[ "${#urls[@]}" -ge 4 ]]; then
      idx=1
      for url in "${urls[@]:0:4}"; do
        webp_name="$(printf '%04d.webp' "$idx")"
        webp_path="$run_dir/$webp_name"
        curl -L --fail --silent --show-error "$url" -o "$webp_path"
        if [[ "$OUTPUT_FORMAT" == "webp" ]]; then
          :
        else
          ext="$OUTPUT_FORMAT"
          [[ "$ext" == "jpeg" ]] && ext="jpg"
          out_name="$(printf '%04d.%s' "$idx" "$ext")"
          out_path="$run_dir/$out_name"
          sips -s format "$OUTPUT_FORMAT" "$webp_path" --out "$out_path" >/dev/null
          rm -f "$webp_path"
        fi
        idx=$((idx + 1))
      done
      success="true"
      python_json_set "$INFO_FILE" "last_generate_at" "$(now_iso)"
      python_json_set "$INFO_FILE" "last_generate_status" "$status"
      python_json_set "$INFO_FILE" "last_generate_output_dir" "$run_dir"
      log "图片已下载到：$run_dir"
      open "$OUTPUT_DIR" >/dev/null 2>&1 || true
      echo "$run_dir"
      break
    fi
  fi

  attempt=$((attempt + 1))
  sleep 2
done

if [[ "$success" != "true" ]]; then
  python_json_set "$INFO_FILE" "last_generate_at" "$(now_iso)"
  python_json_set "$INFO_FILE" "last_generate_status" "failed"
  python_json_set "$INFO_FILE" "last_generate_output_dir" "$run_dir"
  echo "生成失败，最后一次结果：$last_json" >&2
  exit 2
fi
