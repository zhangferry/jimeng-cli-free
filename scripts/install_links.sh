#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILL_NAME="$(basename "$SKILL_DIR")"

targets=(
  "$HOME/.agents/skills"
  "$HOME/.claude/skills"
  "$HOME/.opencode/skills"
  "$HOME/.workbuddy/skills"
  "$HOME/.codebuddy/skills"
)

for target in "${targets[@]}"; do
  mkdir -p "$target"
  ln -sfn "$SKILL_DIR" "$target/$SKILL_NAME"
  echo "linked: $target/$SKILL_NAME -> $SKILL_DIR"
done
