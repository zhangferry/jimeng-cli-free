# 即梦对话复用与免费模型切换 — 设计说明

日期：2026-07-02

## 背景
multica 里的 `jimeng-imagegen` skill 包装 `jimeng-cli-free` 驱动即梦网页端生图。两个问题：

1. **对话爆炸**：每张图都新建一个即梦对话（`auto_create_workspace=true`），账号累积上千对话后被即梦禁止再创建。
2. **模型切换**：希望能切换到「会员免费/无限」模型；默认仍用当前模型。

## 问题 1：按任务复用对话

### 根因
`config.json: auto_create_workspace=true` → `scripts/generate_image.sh` 的 `resolve_workspace()` 每次生图都调用 `jimeng new`（即 `/mweb/v1/workspace/create`）新建会话。

### 方案
- 新增 `scripts/workspace_cache.sh`：按 `JIMENG_TASK_KEY` 把 workspace_id 缓存到 `.workspace-cache.json`。
- `resolve_workspace()` 改为由 `config.json: workspace_reuse` 控制的三模式：
  - `per_task`（默认）：按 `JIMENG_TASK_KEY` 缓存复用；未提供 key 时用 `default` 共享（兜底防爆）。
  - `always_new`：旧行为（每次新建）。
  - `fixed`：固定用 `default_workspace`，永不新建。
- 提取 `jimeng_new_workspace()` 函数（封装 `jimeng new`）。
- multica skill 侧透传 `JIMENG_TASK_KEY`（见附录）。

### 关键决策
- 复用基于 workspace_id 缓存，**不依赖页面 UI**，不受即梦页面改版影响。
- 无 `JIMENG_TASK_KEY` 时共享 `default` 对话 —— 即使 multica skill 未透传，也**不会再每图新建**，保证兜底防爆。

## 问题 2：模型切换

### 现状
`overrides/jimeng/_shared.js` 已支持 `--model`（通过 UI 点选下拉框 option）。缺的是免费模型映射。

### 方案
- `config.json` 新增 `default_free_model`（初始留空 `""`）。
- `generate_image.sh` 解析 `--model free` → 替换为 `default_free_model`；为空则退回 `default_model` 并 log 提示。
- `_shared.js` 的 `modelMap[modelArg] || modelArg` 已支持任意 label，**模型名可直接填即梦下拉里的中文标签**（如 `图片3.0`），无需改 MODEL_MAP。

### 关键决策：`default_free_model` 留空
即梦页面改版（`generate?type=image` 重定向到 `/ai-tool/home`、默认 Agent 模式），程序化探测 5 次都无法稳定进入图片生成模式获取模型列表/免费角标；WebSearch 结论不精确。故初始留空，由用户手查后在 `config.json` 填入。

## 已知风险（本次不处理）
即梦页面改版可能导致 `generate` 流程本身失效（`_shared.js: ensureGeneratePage` 导航的 URL 已重定向到 home，`prepareComposer` 依赖旧页面结构）。最后一次成功生成记录于 2026-06-20，改版很可能发生在其后 11 天内。本次不修复页面适配；如 `generate` 已失效，需单独的「页面适配」工作。

## 验证
- `bash -n` 语法检查所有改动脚本。
- `workspace_cache.sh` 的 set/get 单元测试。
- 运行时验证（待环境/浏览器恢复）：同一 `JIMENG_TASK_KEY` 调用两次 generate，即梦账号对话数仅 +1（用 `jimeng workspaces` 对比）。

## 附录：multica skill 补丁
在 multica 的 `jimeng-imagegen` skill 的 `generate.sh` 开头（`cd "$JIMENG_DIR"` **之前**）加入：

```bash
# 每个任务（workdir）复用同一个即梦对话，避免对话数爆炸
if [[ -z "${JIMENG_TASK_KEY:-}" ]]; then
  JIMENG_TASK_KEY="${MULTICA_TASK_ID:-${TASK_ID:-$(printf '%s' "$(pwd -P)" | shasum -a 256 | awk '{print $1}')}}"
  export JIMENG_TASK_KEY
fi
```

优先用 multica 注入的原生任务 id（`MULTICA_TASK_ID`/`TASK_ID`）；都没有则用 workdir 路径哈希。三者都能保证「每任务一对话」。
