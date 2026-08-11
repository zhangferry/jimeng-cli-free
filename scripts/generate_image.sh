#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"
source "$SCRIPT_DIR/workspace_cache.sh"

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
OUTPUT_BASE=""
REFERENCE=""
REFERENCE_URL=""
USE_CLIPBOARD="false"
MODE=""
WORKSPACE_EXPLICIT="false"
GENERATE_COUNT=""

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

# 调用即梦 API 新建一个会话，成功输出 workspace_id，失败输出空。
jimeng_new_workspace() {
  local ws_json ws_id
  ws_json="$(bash "$RUN_OPENCLI" jimeng new -f json 2>/dev/null || true)"
  ws_id="$(python3 - <<'PY' "$ws_json"
import json, sys
raw = sys.argv[1]
try:
    data = json.loads(raw)
    if isinstance(data, list) and data:
        print(str(data[0].get("workspace_id", "")).strip())
    else:
        print("")
except Exception:
    print("")
PY
)"
  printf '%s\n' "$ws_id"
}

# 解析本次生成使用哪个 workspace。
# 策略由 config 的 workspace_reuse 决定：
#   per_task   按 JIMENG_TASK_KEY 缓存复用（默认；无 key 时用 "default" 共享，兜底防爆）
#   always_new 每次都新建（旧行为）
#   fixed      永不新建，固定用 default_workspace
resolve_workspace() {
  local requested="$1"
  local explicit="$2"
  local mode fallback task_key cached ws_id

  fallback="$(config_get default_workspace)"
  [[ -z "$fallback" ]] && fallback="0"
  mode="$(config_get workspace_reuse)"
  [[ -z "$mode" ]] && mode="per_task"

  # 显式 --workspace 指定优先
  if [[ "$explicit" == "true" && -n "$requested" ]]; then
    printf '%s\n' "$requested"
    return
  fi

  # fixed：固定用默认 workspace，永不新建
  if [[ "$mode" == "fixed" ]]; then
    printf '%s\n' "${requested:-$fallback}"
    return
  fi

  # always_new：旧行为，每次新建
  if [[ "$mode" == "always_new" ]]; then
    ws_id="$(jimeng_new_workspace)"
    if [[ -n "$ws_id" ]]; then
      log "已新建 workspace：$ws_id" >&2
      printf '%s\n' "$ws_id"
      return
    fi
    log "新建 workspace 失败，回退到默认 workspace：$fallback" >&2
    printf '%s\n' "${requested:-$fallback}"
    return
  fi

  # per_task（默认）：按任务标识缓存复用
  task_key="${JIMENG_TASK_KEY:-default}"
  cached="$(workspace_cache_get "$task_key")"
  if [[ -n "$cached" ]]; then
    log "复用任务 [$task_key] 的 workspace：$cached" >&2
    printf '%s\n' "$cached"
    return
  fi

  # 未命中：新建并缓存
  ws_id="$(jimeng_new_workspace)"
  if [[ -n "$ws_id" ]]; then
    workspace_cache_set "$task_key" "$ws_id"
    log "任务 [$task_key] 新建 workspace：$ws_id" >&2
    printf '%s\n' "$ws_id"
    return
  fi

  log "新建 workspace 失败，回退到默认 workspace：$fallback" >&2
  printf '%s\n' "${requested:-$fallback}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt) PROMPT="${2:-}"; shift 2 ;;
    --model) MODEL="${2:-}"; shift 2 ;;
    --aspect) ASPECT="${2:-}"; shift 2 ;;
    --workspace) WORKSPACE="${2:-}"; WORKSPACE_EXPLICIT="true"; shift 2 ;;
    --format) OUTPUT_FORMAT="${2:-}"; shift 2 ;;
    --output) OUTPUT_BASE="${2:-}"; shift 2 ;;
    --reference|--image) REFERENCE="${2:-}"; shift 2 ;;
    --reference-url|--image-url) REFERENCE_URL="${2:-}"; shift 2 ;;
    --clipboard) USE_CLIPBOARD="true"; shift ;;
    --mode) MODE="${2:-}"; shift 2 ;;
    --generate-count) GENERATE_COUNT="${2:-}"; shift 2 ;;
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

# --model free：切换到配置的「免费/会员无限」模型；未配置则退回默认模型。
if [[ "$MODEL" == "free" ]]; then
  free_model="$(config_get default_free_model)"
  if [[ -n "$free_model" ]]; then
    MODEL="$free_model"
    log "使用免费模型：$MODEL" >&2
  else
    MODEL=""
    log "未配置 default_free_model，--model free 退回默认模型。请在 config.json 设置免费模型名称（即梦页面模型下拉里对应的文字）。" >&2
  fi
fi

MODEL="${MODEL:-$(config_get default_model)}"
ASPECT="${ASPECT:-$(config_get default_aspect)}"
OUTPUT_FORMAT="${OUTPUT_FORMAT:-$(config_get default_output_format)}"
WAIT_SECONDS="$(config_get generate_wait_seconds)"
MAX_ATTEMPTS="$(config_get max_generate_attempts)"
MODE="${MODE:-text}"
GENERATE_COUNT="${GENERATE_COUNT:-$(config_get default_generate_count)}"
GENERATE_COUNT="${GENERATE_COUNT:-1}"
REFERENCE="$(prepare_reference_file "$REFERENCE" "$REFERENCE_URL" "$USE_CLIPBOARD")"
assert_reference_is_image "$REFERENCE"

if ! [[ "$GENERATE_COUNT" =~ ^[1-9][0-9]*$ ]]; then
  echo "--generate-count 必须是大于 0 的整数" >&2
  exit 1
fi

case "$OUTPUT_FORMAT" in
  png|jpg|jpeg|webp) ;;
  *)
    echo "不支持的输出格式：${OUTPUT_FORMAT}，支持 png/jpg/webp" >&2
    exit 1
    ;;
esac

# --output 指定本次结果输出根目录；未传则回退到默认 output/
OUTPUT_BASE="${OUTPUT_BASE:-$OUTPUT_DIR}"
if [[ ! -d "$OUTPUT_BASE" ]]; then
  mkdir -p "$OUTPUT_BASE" || { echo "无法创建输出目录：$OUTPUT_BASE" >&2; exit 1; }
fi

bash "$SCRIPT_DIR/ensure_opencli_and_jimeng.sh"
bash "$SCRIPT_DIR/sync_fork_patch.sh"
WORKSPACE="$(resolve_workspace "$WORKSPACE" "$WORKSPACE_EXPLICIT")"

attempt=1
success="false"
last_json=""
run_dir=""

while [[ "$attempt" -le "$MAX_ATTEMPTS" ]]; do
  ts="$(date +%Y%m%d-%H%M%S)"
  run_dir="$OUTPUT_BASE/$ts"
  mkdir -p "$run_dir"
  printf '%s\n' "$PROMPT" > "$run_dir/prompt.txt"

  log "第 $attempt 次调用 skill 私有 runtime 的 opencli jimeng generate"
  json_path="$run_dir/result.json"
  err_path="$run_dir/result.stderr.log"
  cmd=(jimeng generate "$PROMPT" --model "$MODEL" --aspect "$ASPECT" --workspace "$WORKSPACE" --wait "$WAIT_SECONDS" --generate_count "$GENERATE_COUNT" --mode "$MODE" -f json)
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
    if [[ "${#urls[@]}" -ge 1 ]]; then
      idx=1
      for url in "${urls[@]:0:1}"; do
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
          sips_format="$(sips_format_for_output "$OUTPUT_FORMAT")"
          sips -s format "$sips_format" "$webp_path" --out "$out_path" >/dev/null
          rm -f "$webp_path"
        fi
        idx=$((idx + 1))
      done
      success="true"
      python_json_set "$INFO_FILE" "last_generate_at" "$(now_iso)"
      python_json_set "$INFO_FILE" "last_generate_status" "$status"
      python_json_set "$INFO_FILE" "last_generate_output_dir" "$run_dir"
      log "图片已下载到：$run_dir"
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
