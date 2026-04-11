#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

require_cmd python3
require_cmd node
require_cmd npm
require_cmd unzip
require_cmd gh

OPENCLI_PACKAGE="$(config_get opencli_package)"
EXTENSION_REPO="$(config_get extension_repo)"
RUN_OPENCLI="$SCRIPT_DIR/run_opencli.sh"

if [[ "$(info_get extension_downloaded)" == "true" ]] \
  && [[ "$(info_get doctor_ok)" == "true" ]] \
  && [[ "$(info_get jimeng_logged_in)" == "true" ]] \
  && [[ "$(info_get runtime_ready)" == "true" ]] \
  && skill_opencli_ready; then
  log "info.json 显示 skill 私有 runtime、插件和即梦登录检测已通过，跳过重复检测。"
  exit 0
fi

if ! command -v opencli >/dev/null 2>&1; then
  log "未检测到系统 opencli，开始安装 $OPENCLI_PACKAGE 作为通用命令入口。"
  npm install -g "$OPENCLI_PACKAGE"
fi

OPENCLI_VERSION="$(opencli --version 2>/dev/null | head -n 1 | tr -d '\r')"
python_json_set "$INFO_FILE" "opencli_version" "$OPENCLI_VERSION"
set_info_bool "opencli_installed" "true"

bash "$SCRIPT_DIR/sync_fork_patch.sh"

latest_tag="$(gh release view --repo "$EXTENSION_REPO" --json tagName --jq '.tagName' 2>/dev/null || true)"
if [[ -z "$latest_tag" ]]; then
  latest_tag="latest"
fi

extension_name="opencli-extension.zip"
zip_path="$DOWNLOADS_DIR/$extension_name"
unpack_dir="$DOWNLOADS_DIR/${extension_name%.zip}/unpacked"
if [[ ! -f "$zip_path" ]]; then
  log "下载浏览器插件到 $zip_path"
  if ! gh release download "$latest_tag" --repo "$EXTENSION_REPO" -p "$extension_name" -D "$DOWNLOADS_DIR"; then
    log "插件自动下载失败，请手动去 $EXTENSION_REPO releases 下载插件。"
  fi
fi
if [[ -f "$zip_path" ]]; then
  if [[ ! -d "$unpack_dir" ]]; then
    mkdir -p "$unpack_dir"
    unzip -oq "$zip_path" -d "$unpack_dir"
  fi
  set_info_bool "extension_downloaded" "true"
  python_json_set "$INFO_FILE" "extension_zip" "$zip_path"
  python_json_set "$INFO_FILE" "extension_unpacked_dir" "$unpack_dir"
  log "浏览器插件已准备好：$unpack_dir"
  log "如果尚未在 Edge/Chrome 中加载 unpacked 插件，请现在去加载。"
fi

doctor_ok="false"
if bash "$RUN_OPENCLI" doctor >/tmp/opencli_jimeng_doctor.log 2>&1; then
  doctor_ok="true"
fi
set_info_bool "doctor_ok" "$doctor_ok"
python_json_set "$INFO_FILE" "last_doctor_at" "$(now_iso)"

jimeng_ok="false"
if bash "$RUN_OPENCLI" jimeng workspaces -f json >/tmp/opencli_jimeng_workspaces.json 2>/tmp/opencli_jimeng_workspaces.err; then
  jimeng_ok="true"
fi

if [[ "$jimeng_ok" == "true" ]]; then
  set_info_bool "jimeng_logged_in" "true"
  python_json_set "$INFO_FILE" "last_jimeng_check_at" "$(now_iso)"
  log "skill 私有 opencli runtime、浏览器插件和即梦登录状态检测通过。"
else
  set_info_bool "jimeng_logged_in" "false"
  python_json_set "$INFO_FILE" "last_jimeng_check_at" "$(now_iso)"
  err="$(cat /tmp/opencli_jimeng_workspaces.err 2>/dev/null || true)"
  if printf '%s' "$err" | rg -q 'Not logged in|sign in first'; then
    log "即梦尚未登录，请先在浏览器打开 https://jimeng.jianying.com 并登录后再重试。"
  else
    log "skill 私有 runtime 的 jimeng 最小测试未通过。请先确认：1）浏览器已打开；2）插件已加载；3）即梦已登录。"
    [[ -n "$err" ]] && printf '%s\n' "$err" >&2
  fi
  exit 2
fi
