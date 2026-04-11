name: jimeng-image-gen-opencli
description: 当用户说“使用即梦”“使用即梦生成图片”或想用 OpenCLI 驱动即梦网页端稳定生图、自动安装/检测 opencli 与浏览器插件、同步私有 runtime 里的 jimeng 模型/比例/stale-page 修复，并把 4 张结果图下载到本地 output 目录时使用。
---

# Jimeng Image Gen OpenCLI

这个 skill 负责三件事：

1. 安装或检测 `opencli` 与浏览器插件
2. 在 skill 目录内维护一份受控的私有 OpenCLI runtime，并同步 `leigegehaha/OpenCLI` 里针对 `jimeng generate` 的增强补丁
3. 用即梦网页端生成图片，并把每次生成的 4 张图下载到本 skill 的 `output/` 目录

## 文件

- 配置：`config.json`
- 状态：`info.json`
- 输出目录：`output/`
- 脚本目录：`scripts/`
- 用户入口：`bin/jimeng-image`
- 别名入口：`bin/jimeng-image-gen-opencli`

## 默认规则

先读取：

- `config.json`
- `info.json`

如果用户没有明确说模型和比例：

- 默认模型使用 `config.json` 的 `default_model`
- 默认比例使用 `config.json` 的 `default_aspect`
- 默认输出格式使用 `config.json` 的 `default_output_format`

如果用户没有明确说 workspace：

- 默认 workspace 使用 `config.json` 的 `default_workspace`
- 私有 runtime 来源默认使用 `config.json` 里的固定 commit 归档包

## 支持的模型

- `high_aes_general_v50`：图片5.0 Lite
- `high_aes_general_v42`：图片4.6
- `high_aes_general_v45`：图片4.5
- `high_aes_general_v41`：图片4.1
- `high_aes_general_v40`：图片4.0

默认值：

- `high_aes_general_v50`

## 支持的比例

- `smart`
- `21:9`
- `16:9`
- `3:2`
- `4:3`
- `1:1`
- `3:4`
- `2:3`
- `9:16`

默认值：

- `9:16`

## 使用流程

### 1. 先确保环境可用

先执行：

```bash
bash scripts/ensure_opencli_and_jimeng.sh
```

这个脚本会：

- 检查系统 `opencli` 是否已安装；若未安装则自动执行 `npm install -g @jackwener/opencli` 作为通用命令入口
- 构建并检查本 skill 私有的 OpenCLI runtime；后续即梦能力默认走这份私有 runtime，而不是系统全局 `opencli`
- 下载 OpenCLI 浏览器插件到 skill 目录下的 `downloads/`
- 提醒用户去浏览器里加载插件
- 如果 `info.json` 里显示最近一次私有 runtime、`doctor` 和 `jimeng` 检测已成功，则跳过重复检测
- 否则执行私有 runtime 的 `doctor`
- 再用私有 runtime 的 `jimeng workspaces -f json` 做最小可用性测试
- 若检测到未登录即梦，则明确提醒用户先在浏览器里登录 `jimeng.jianying.com`

如果脚本提示插件未安装或即梦未登录，不要继续生成，先把问题告诉用户。

### 2. 同步 fork 补丁

然后执行：

```bash
bash scripts/sync_fork_patch.sh
```

这个脚本会：

- 拉取或更新 `config.json` 里指定的 fork 仓库
- 读取 fork 当前 commit
- 如果 `info.json` 已记录同一个 commit 已同步成功，则跳过重复构建
- 否则构建 skill 目录下的私有 runtime：`vendor/OpenCLI`
- 构建完成后，再把 skill 自己的本地 override 覆盖到私有 runtime 里

如果同步完成，会把 runtime commit、runtime path 和构建时间写入 `info.json`。

### 3. 生成并下载图片

准备好参数后执行：

```bash
bash bin/jimeng-image generate "<用户提示词>" --model "<模型>" --aspect "<比例>"
```

或执行底层脚本：

```bash
bash scripts/generate_image.sh \
  --prompt "<用户提示词>" \
  --model "<模型>" \
  --aspect "<比例>" \
  --workspace "<workspace>"
```

参数规则：

- `--prompt` 必填
- `--model` 可选，默认取 `config.json`
- `--aspect` 可选，默认取 `config.json`
- `--workspace` 可选，默认取 `config.json`

脚本行为：

- 自动重跑环境检测与 fork 同步
- 调用 skill 私有 runtime 的 `opencli jimeng generate`
- 若失败或没有拿到图片，最多重试 2 次
- 每次成功生成后创建新的时间戳输出目录
- 将即梦返回的 4 张图片下载到该目录
- 按 `config.json` 的输出格式把 `webp` 自动转换为 `png` 或 `jpg`
- 自动打开 `output/` 目录，并提醒用户查看

## 输出约定

每次生成都在 `output/<timestamp>/` 下创建一组新结果，至少包含：

- `result.json`
- `prompt.txt`
- `0001.<format>`
- `0002.<format>`
- `0003.<format>`
- `0004.<format>`

其中 `<format>` 默认是 `png`，也可以在 `config.json` 里改成 `jpg` 或 `webp`。

## 失败处理

如果下载失败但 `opencli` 返回了图片链接：

- 先重试下载
- 仍失败时，再调用一次 `opencli jimeng generate` 获取当前任务图片

如果 `opencli jimeng generate` 整体失败：

- 最多重复提交 2 次
- 仍失败就停止，并把最后一次 stderr/JSON 结果告诉用户

## 注意

- 这个 skill 会真实消耗即梦额度
- 即梦相关能力默认走 skill 自带的私有 OpenCLI runtime，尽量避免受到系统全局 `opencli` 升级的影响
- 私有 runtime 默认优先使用固定 commit 归档包，而不是直接追踪 fork 分支 HEAD；这样更利于复现和分发
- 除非用户明确要求，默认使用：
  - `high_aes_general_v50`
  - `9:16`
- 默认输出格式：
  - `png`
- 不要手改 `info.json` 的语义字段；让脚本维护它
