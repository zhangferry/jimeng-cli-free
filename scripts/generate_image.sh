#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

require_cmd python3
require_cmd curl
require_cmd sips
require_cmd file

RUN_OPENCLI="$SCRIPT_DIR/run_opencli.sh"

PROMPT=""
MODEL=""
ASPECT=""
WORKSPACE=""
OUTPUT_FORMAT=""
REFERENCE=""
REFERENCE_URL=""
USE_CLIPBOARD="false"
MODE=""
WORKSPACE_EXPLICIT="false"

mkdir -p "$TMP_DIR"

is_http_url() {
  [[ "$1" =~ ^https?:// ]]
}

guess_extension_from_mime() {
  local mime="$1"
  case "$mime" in
    image/png) printf '.png\n' ;;
    image/jpeg) printf '.jpg\n' ;;
    image/webp) printf '.webp\n' ;;
    image/gif) printf '.gif\n' ;;
    *) printf '\n' ;;
  esac
}

finalize_reference_file() {
  local target="$1"
  local mime
  local ext
  mime="$(file --brief --mime-type "$target" || true)"
  ext="$(guess_extension_from_mime "$mime")"
  if [[ -n "$ext" && "$target" != *"$ext" ]]; then
    local renamed="${target}${ext}"
    mv "$target" "$renamed"
    printf '%s\n' "$renamed"
    return
  fi
  printf '%s\n' "$target"
}

download_reference_url() {
  local url="$1"
  local target="$2"
  curl -L --fail --silent --show-error "$url" -o "$target"
}

export_clipboard_image() {
  local target="$1"
  require_cmd swift
  swift - "$target" <<'SWIFT'
import AppKit
import Foundation

let output = CommandLine.arguments[1]
let board = NSPasteboard.general
let classes: [AnyClass] = [NSImage.self]
let options: [NSPasteboard.ReadingOptionKey: Any] = [:]

guard let image = board.readObjects(forClasses: classes, options: options)?.first as? NSImage else {
    fputs("剪贴板里没有图片\n", stderr)
    exit(2)
}

guard let tiff = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let data = bitmap.representation(using: .png, properties: [:]) else {
    fputs("无法从剪贴板导出图片\n", stderr)
    exit(3)
}

do {
    try data.write(to: URL(fileURLWithPath: output))
} catch {
    fputs("写入剪贴板图片失败: \(error)\n", stderr)
    exit(4)
}
SWIFT
}

prepare_reference_file() {
  local input="$1"
  local url="$2"
  local clipboard="$3"
  local resolved=""

  if [[ "$clipboard" == "true" ]]; then
    resolved="$TMP_DIR/reference-clipboard-$(date +%Y%m%d-%H%M%S).png"
    export_clipboard_image "$resolved"
    printf '%s\n' "$resolved"
    return
  fi

  if [[ -n "$url" ]]; then
    resolved="$TMP_DIR/reference-url-$(date +%Y%m%d-%H%M%S)"
    download_reference_url "$url" "$resolved"
    finalize_reference_file "$resolved"
    return
  fi

  if [[ -n "$input" && "$(printf '%s' "$input" | tr '[:upper:]' '[:lower:]')" == "clipboard" ]]; then
    resolved="$TMP_DIR/reference-clipboard-$(date +%Y%m%d-%H%M%S).png"
    export_clipboard_image "$resolved"
    printf '%s\n' "$resolved"
    return
  fi

  if [[ -n "$input" && "$(printf '%s' "$input" | tr '[:upper:]' '[:lower:]')" == "pasteboard" ]]; then
    resolved="$TMP_DIR/reference-clipboard-$(date +%Y%m%d-%H%M%S).png"
    export_clipboard_image "$resolved"
    printf '%s\n' "$resolved"
    return
  fi

  if [[ -n "$input" ]] && is_http_url "$input"; then
    resolved="$TMP_DIR/reference-url-$(date +%Y%m%d-%H%M%S)"
    download_reference_url "$input" "$resolved"
    finalize_reference_file "$resolved"
    return
  fi

  printf '%s\n' "$input"
}

assert_reference_is_image() {
  local ref="$1"
  [[ -z "$ref" ]] && return
  if [[ ! -f "$ref" ]]; then
    echo "参考图不存在：$ref" >&2
    exit 1
  fi
  local mime
  mime="$(file --brief --mime-type "$ref" || true)"
  case "$mime" in
    image/png|image/jpeg|image/webp|image/gif) ;;
    *)
      echo "参考图不是受支持的图片文件：$ref ($mime)" >&2
      exit 1
      ;;
  esac
}

resolve_workspace() {
  local requested="$1"
  local explicit="$2"
  local fallback
  local auto_create
  local ws_json
  local ws_id

  fallback="$(config_get default_workspace)"
  auto_create="$(config_get auto_create_workspace)"

  if [[ "$explicit" == "true" && -n "$requested" ]]; then
    printf '%s\n' "$requested"
    return
  fi

  if [[ "$auto_create" == "true" ]]; then
    log "本次生成默认新建 workspace，降低命中旧结果的风险。" >&2
    ws_json="$(bash "$RUN_OPENCLI" jimeng new -f json 2>/dev/null || true)"
    ws_id="$(python3 - <<'PY' "$ws_json"
import json, sys
raw = sys.argv[1]
try:
    data = json.loads(raw)
    if isinstance(data, list) and data:
        print(str(data[0].get("workspace_id", "")))
    else:
        print("")
except Exception:
    print("")
PY
)"
    if [[ -n "$ws_id" ]]; then
      log "已创建新的 workspace：$ws_id" >&2
      printf '%s\n' "$ws_id"
      return
    fi
    log "新建 workspace 失败，回退到默认 workspace：$fallback" >&2
  fi

  printf '%s\n' "${requested:-$fallback}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt) PROMPT="${2:-}"; shift 2 ;;
    --model) MODEL="${2:-}"; shift 2 ;;
    --aspect) ASPECT="${2:-}"; shift 2 ;;
    --workspace) WORKSPACE="${2:-}"; WORKSPACE_EXPLICIT="true"; shift 2 ;;
    --format) OUTPUT_FORMAT="${2:-}"; shift 2 ;;
    --reference|--image) REFERENCE="${2:-}"; shift 2 ;;
    --reference-url|--image-url) REFERENCE_URL="${2:-}"; shift 2 ;;
    --clipboard) USE_CLIPBOARD="true"; shift ;;
    --mode) MODE="${2:-}"; shift 2 ;;
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
OUTPUT_FORMAT="${OUTPUT_FORMAT:-$(config_get default_output_format)}"
WAIT_SECONDS="$(config_get generate_wait_seconds)"
MAX_ATTEMPTS="$(config_get max_generate_attempts)"
MODE="${MODE:-text}"
REFERENCE="$(prepare_reference_file "$REFERENCE" "$REFERENCE_URL" "$USE_CLIPBOARD")"
assert_reference_is_image "$REFERENCE"

case "$OUTPUT_FORMAT" in
  png|jpg|jpeg|webp) ;;
  *)
    echo "不支持的输出格式：$OUTPUT_FORMAT，支持 png/jpg/webp" >&2
    exit 1
    ;;
esac

bash "$SCRIPT_DIR/ensure_opencli_and_jimeng.sh"
bash "$SCRIPT_DIR/sync_fork_patch.sh"
WORKSPACE="$(resolve_workspace "$WORKSPACE" "$WORKSPACE_EXPLICIT")"

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
  cmd=(jimeng generate "$PROMPT" --model "$MODEL" --aspect "$ASPECT" --workspace "$WORKSPACE" --wait "$WAIT_SECONDS" --mode "$MODE" -f json)
  if [[ -n "$REFERENCE" ]]; then
    cmd+=(--reference "$REFERENCE")
  fi
  if OPENCLI_DIAGNOSTIC=1 bash "$RUN_OPENCLI" "${cmd[@]}" >"$json_path" 2>"$err_path"; then
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
