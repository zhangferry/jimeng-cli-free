#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

require_cmd git
require_cmd npm
require_cmd python3
require_cmd gh
require_cmd curl
require_cmd tar

FORK_REPO="$(config_get fork_repo)"
FORK_BRANCH="$(config_get fork_branch)"
RUNTIME_SOURCE_MODE="$(config_get runtime_source_mode)"
RUNTIME_PINNED_COMMIT="$(config_get runtime_pinned_commit)"
REPO_DIR="$OPENCLI_VENDOR_REPO_DIR"
mkdir -p "$RUNTIME_CACHE_DIR"

download_archive_source() {
  local ref="$1"
  local archive_path="$RUNTIME_CACHE_DIR/opencli-${ref}.tar.gz"
  local url="https://github.com/$FORK_REPO/archive/$ref.tar.gz"
  if [[ ! -f "$archive_path" ]]; then
    log "下载固定 commit 归档包：$ref"
    curl -L --fail --silent --show-error "$url" -o "$archive_path"
  fi
  rm -rf "$REPO_DIR"
  local tmp_dir="$VENDOR_DIR/.tmp-opencli-$ref-$$"
  rm -rf "$tmp_dir"
  mkdir -p "$tmp_dir"
  tar -xzf "$archive_path" -C "$tmp_dir"
  local extracted_dir
  extracted_dir="$(find "$tmp_dir" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [[ -z "$extracted_dir" ]]; then
    echo "归档包解压失败：$archive_path" >&2
    exit 1
  fi
  mv "$extracted_dir" "$REPO_DIR"
  rm -rf "$tmp_dir"
}

prepare_git_source() {
  if [[ ! -d "$REPO_DIR/.git" ]]; then
    git clone "https://github.com/$FORK_REPO.git" "$REPO_DIR" >/dev/null 2>&1
  fi
  git -C "$REPO_DIR" fetch origin "$FORK_BRANCH" --quiet
  git -C "$REPO_DIR" checkout "$FORK_BRANCH" --quiet
  git -C "$REPO_DIR" reset --hard "origin/$FORK_BRANCH" --quiet
}

if [[ "$RUNTIME_SOURCE_MODE" == "archive" && -n "$RUNTIME_PINNED_COMMIT" ]]; then
  fork_commit="$RUNTIME_PINNED_COMMIT"
else
  prepare_git_source
  fork_commit="$(git -C "$REPO_DIR" rev-parse HEAD)"
fi

skip_fork_copy="false"
if skill_opencli_ready \
  && [[ "$(info_get fork_synced)" == "true" \
  && "$(info_get fork_commit)" == "$fork_commit" \
  && "$(info_get runtime_source_mode)" == "$RUNTIME_SOURCE_MODE" ]]; then
  skip_fork_copy="true"
  log "fork 补丁已经同步到 skill 私有 runtime，无需重复构建。"
fi

if [[ "$skip_fork_copy" != "true" ]]; then
  if [[ "$RUNTIME_SOURCE_MODE" == "archive" && -n "$RUNTIME_PINNED_COMMIT" ]]; then
    download_archive_source "$RUNTIME_PINNED_COMMIT"
  else
    prepare_git_source
    fork_commit="$(git -C "$REPO_DIR" rev-parse HEAD)"
  fi
  log "构建 fork 仓库以生成最新 dist 文件"
  npm install --prefix "$REPO_DIR" >/dev/null
  npm run build --prefix "$REPO_DIR" >/dev/null
fi

copy_file() {
  local src="$1"
  local dst="$2"
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
}

if [[ -d "$SKILL_DIR/overrides/jimeng" ]]; then
  while IFS= read -r override_file; do
    rel_path="${override_file#"$SKILL_DIR/overrides/jimeng/"}"
    copy_file "$override_file" "$REPO_DIR/clis/jimeng/$rel_path"
  done < <(find "$SKILL_DIR/overrides/jimeng" -type f -name '*.js' | sort)
  log "已应用 skill 本地 jimeng 适配器覆盖补丁。"
fi

if [[ -f "$REPO_DIR/dist/src/build-manifest.js" ]]; then
  node "$REPO_DIR/dist/src/build-manifest.js" >/dev/null
  log "已刷新 skill 私有 runtime 的 cli-manifest.json。"
fi

set_info_bool "fork_synced" "true"
set_info_bool "runtime_ready" "true"
python_json_set "$INFO_FILE" "fork_repo" "$FORK_REPO"
python_json_set "$INFO_FILE" "fork_branch" "$FORK_BRANCH"
python_json_set "$INFO_FILE" "fork_commit" "$fork_commit"
python_json_set "$INFO_FILE" "runtime_mode" "skill_managed"
python_json_set "$INFO_FILE" "runtime_path" "$REPO_DIR"
python_json_set "$INFO_FILE" "runtime_commit" "$fork_commit"
python_json_set "$INFO_FILE" "runtime_version" "$(skill_opencli_version)"
python_json_set "$INFO_FILE" "runtime_source_mode" "$RUNTIME_SOURCE_MODE"
python_json_set "$INFO_FILE" "runtime_last_built_at" "$(now_iso)"
python_json_set "$INFO_FILE" "last_sync_at" "$(now_iso)"
log "skill 私有 opencli runtime 已同步完成：$fork_commit"
