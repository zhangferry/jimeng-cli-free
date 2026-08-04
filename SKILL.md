---
name: jimeng-cli-free
description: 用即梦（Jimeng / Dreamina）网页端生成图片。当用户说「使用即梦」「即梦生图」「jimeng」「AI 画图」「AI 生图」「generate image」时使用。支持文生图、参考图生图、图片编辑，默认生成 1 张图下载到本地。需先完成一次性的浏览器插件加载与即梦登录。
---

# jimeng-cli-free（即梦网页端生图 CLI）

驱动即梦网页端生图的本机命令行工具。支持文生图、参考图生图、图片编辑，每次默认生成 **1 张** 图并下载到本地，可指定输出目录。

## 定位本 CLI

本 skill 的目录就是 CLI 仓库根目录。两种定位方式任选其一：

```bash
# 方式 1：环境变量（外部 agent 推荐用这个，路径可移植）
export JIMENG_CLI_DIR="/path/to/jimeng-cli-free"

# 方式 2：直接用 skill 自身目录（install_links 安装后同样适用）
JIMENG_CLI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```

所有命令都以 `bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" ...` 形式调用。**不需要 cd 进仓库目录。**

查看完整帮助与版本：

```bash
bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" help
bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" version
```

## 首次 Setup（一次性）

如果 `$JIMENG_CLI_DIR/bin/jimeng-cli-free` 不存在，先引导用户完成：

### 1. 克隆仓库
```bash
git clone https://github.com/zhangferry/jimeng-cli-free.git "$JIMENG_CLI_DIR"
```

### 2. 检查系统命令
```bash
for cmd in python3 node npm git gh curl tar unzip sips; do
  command -v "$cmd" >/dev/null 2>&1 || echo "缺失：$cmd"
done
```
缺什么补什么（macOS 一般自带，`gh` 可 `brew install gh`）。仅支持 macOS。

### 3. 首次 ensure（会预期性地在「浏览器桥未连接」处停下，正常）
```bash
bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" ensure
```
这一步会安装 opencli runtime 并下载浏览器插件到 `downloads/`。**在浏览器插件加载完成前，它会在「Browser Bridge not connected」处失败 —— 这是预期的，继续下一步。**

### 4. 手动加载浏览器插件（关键，不可跳过）
1. Chrome 打开 `chrome://extensions`（Edge 打开 `edge://extensions`）
2. 打开「开发者模式 / 开发人员模式」
3. 点「加载已解压的扩展程序 / 加载解压缩的扩展」
4. 选择目录：`$JIMENG_CLI_DIR/downloads/opencli-extension/unpacked`

### 5. 登录即梦
在同一个浏览器里打开 `https://jimeng.jianying.com` 并登录。

### 6. 再次 ensure 验证
```bash
bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" ensure
```
通过即代表 runtime、浏览器插件、即梦登录三件套就绪。

## 命令

### 文生图
```bash
bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" generate "<提示词>" [--model 模型] [--aspect 比例] [--format 格式] [--output 目录]
```

### 参考图生图
```bash
# 本地文件
bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" generate "<提示词>" --reference /path/to/ref.png --mode reference
# 图片 URL
bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" generate "<提示词>" --reference https://example.com/ref.png --mode reference
# 系统剪贴板
bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" generate "<提示词>" --clipboard --mode reference
```

### 图片编辑
```bash
bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" edit /path/to/input.png "<编辑提示词>" [--model 模型] [--aspect 比例]
```

### 环境自检
```bash
bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" ensure
```

## 参数

| 参数 | 取值 | 默认 |
|------|------|------|
| `--model` | `high_aes_general_v47`（图片4.7）、`high_aes_general_v50`（5.0 Lite）、`high_aes_general_v42`（4.6）、`high_aes_general_v45`（4.5）、`high_aes_general_v41`（4.1）、`high_aes_general_v40`（4.0）、`free`（别名，切到 `config.json` 的 `default_free_model`）、或即梦下拉里的中文标签 | `high_aes_general_v47` |
| `--aspect` | `smart`、`21:9`、`16:9`、`3:2`、`4:3`、`1:1`、`3:4`、`2:3`、`9:16` | `9:16` |
| `--format` | `png`、`jpg`、`webp` | `png` |
| `--output` | 任意可写目录路径；不传则用 `<仓库>/output/` | `output/` |
| `--mode` | `text`、`reference`、`edit` | `text` |
| `--reference` | 本地路径 / 图片 URL / `clipboard` | — |
| `--clipboard` | 用剪贴板图片作参考图 | `false` |
| `--workspace` | 指定即梦对话 id | 按任务复用 |
| `--generate-count` | `>0` 整数 | `1` |

> 参考图建议优先用 `high_aes_general_v47` / `high_aes_general_v50` / `high_aes_general_v42`。
> `generate` 的 `<提示词>` 必须是 `generate` 之后第一个非 `--` 的参数。
> 只支持上表列出的比例；遇到不支持的（如 `5:4`）请换最接近的（如 `4:3`）。

## 输出约定

- 每次生成创建 `<输出根>/<时间戳>/` 目录，内含：
  - `0001.<format>` — 生成结果图（默认 `0001.png`，**单张**）
  - `prompt.txt` — 本次提示词
  - `result.json` — runtime 原始返回
  - `result.stderr.log` — 运行时诊断日志
- **成功时 stdout 只输出该目录的绝对路径**，方便脚本捕获；进度/日志走 stderr。
- 想把图直接落到当前工作目录：加 `--output "$(pwd)"`。

## 退出码

| 码 | 含义 |
|----|------|
| `0` | 成功 |
| `1` | 参数错误 / 缺少必填项 |
| `2` | 生成失败（已重试 `max_generate_attempts` 次仍失败） |
| `75` | 浏览器会话锁等待超时（另一个即梦任务正在占用浏览器） |

## workspace 复用（避免账号对话数爆炸）

默认按**任务**复用同一个即梦对话，而不是每张图新建一个对话：

- 复用策略由 `config.json` 的 `workspace_reuse` 控制：`per_task`（默认）/ `always_new` / `fixed`
- 调用方通过环境变量 `JIMENG_TASK_KEY` 传入任务标识；**同一 key 的多次调用共享同一个即梦对话**
- 未传 `JIMENG_TASK_KEY` 时，所有调用共享一个 `default` 对话（兜底）

```bash
export JIMENG_TASK_KEY="my-poster-task-001"
bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" generate "第一张" --aspect 16:9
bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" generate "第二张" --aspect 16:9   # 复用同一对话
```

## 错误处理与诊断

- 脚本内部已带重试（默认最多 3 次）。**失败后不要自动改写 prompt 重试**，先把诊断信息交给用户。
- 看失败原因：`cat <输出目录>/result.stderr.log` 和 `result.json`。
- 自检环境：`bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" ensure`。
- 常见失败：浏览器未开 / 插件未加载 / 即梦未登录 / 账号无积分 / 网络访问不到 GitHub 或即梦。

## 示例

```bash
# 默认：结果落 <仓库>/output/<时间戳>/0001.png
bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" generate "海边玻璃建筑，青绿色植物" --model high_aes_general_v47 --aspect 16:9

# 结果直接落到当前工作目录
bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" generate "极简产品海报" --aspect 16:9 --output "$(pwd)"

# 参考图生图
bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" generate "改成电影海报风格" --reference ./ref.png --mode reference

# 图片编辑
bash "$JIMENG_CLI_DIR/bin/jimeng-cli-free" edit ./input.png "把主体改成水彩插画风格" --aspect 16:9
```

## 默认值速查

未显式指定时，从 `config.json` 读取：模型 `high_aes_general_v47`、比例 `9:16`、格式 `png`、数量 `1`。改默认值就改 `config.json`。

---

## 维护章节（仅供维护者，外部用户可忽略）

- **私有 runtime**：即梦能力默认走 skill 自带的私有 runtime（`vendor/OpenCLI`），不依赖系统全局 opencli，避免全局升级破坏行为。runtime 默认用 `config.json` 里固定 commit 的归档包（`runtime_source_mode: archive` + `runtime_pinned_commit`），利于复现与分发。
- **fork 补丁同步**：`scripts/sync_fork_patch.sh` 拉 `config.json` 指定的 fork（`leigegehaha/OpenCLI`），构建 `vendor/OpenCLI`，再覆盖 `overrides/` 下的本地增强补丁。同步结果写入 `info.json`。
- **状态文件**：`info.json` 由脚本维护（runtime commit、上次生图状态等），**不要手改**；`.workspace-cache.json` 是 per_task 的 workspace 缓存。
- **关键脚本**：
  - `scripts/generate_image.sh` — 生图主流程（参数解析、`--output`、重试、下载、`sips` 转码）
  - `scripts/edit_image.sh` — 图片编辑，透传给 `generate_image.sh --mode edit`
  - `scripts/ensure_opencli_and_jimeng.sh` — 环境与登录自检
  - `scripts/sync_fork_patch.sh` — 私有 runtime 构建与补丁覆盖
  - `scripts/run_opencli.sh` — 私有 runtime 执行器（带浏览器会话锁 + 退出清理）
- **关键函数（`scripts/common.sh`）**：`config_get`、`skill_opencli_version`、`python_json_get/set`、`OUTPUT_DIR`。
