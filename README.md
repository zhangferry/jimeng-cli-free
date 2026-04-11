# jimeng-image-gen-opencli

一个可分发的本地 skill：使用 OpenCLI 驱动即梦网页端稳定生图，支持模型选择、比例选择、固定 commit 私有 runtime、原图下载，以及 `webp -> png/jpg` 自动转换。

## 特性

- 自动检测或安装系统 `opencli`
- 自动下载 OpenCLI 浏览器插件，并提示用户加载
- 使用 skill 私有 OpenCLI runtime，尽量避免被系统全局 `opencli` 升级影响
- 私有 runtime 默认从固定 commit 归档包恢复，便于复现
- 自动同步即梦专用 override
- 支持模型：
  - `high_aes_general_v50`：图片5.0 Lite
  - `high_aes_general_v42`：图片4.6
  - `high_aes_general_v45`：图片4.5
  - `high_aes_general_v41`：图片4.1
  - `high_aes_general_v40`：图片4.0
- 支持比例：
  - `smart`
  - `21:9`
  - `16:9`
  - `3:2`
  - `4:3`
  - `1:1`
  - `3:4`
  - `2:3`
  - `9:16`
- 下载 4 张结果图到本地 `output/`
- 默认把结果转成 `png`，也可改为 `jpg` 或 `webp`

## 快速开始

1. 克隆仓库

```bash
git clone https://github.com/leigegehaha/jimeng-image-gen-opencli.git
cd jimeng-image-gen-opencli
```

2. 准备环境

```bash
bash bin/jimeng-image ensure
```

3. 生成图片

```bash
bash bin/jimeng-image generate "青绿色玻璃建筑与植物，横版海报" --model high_aes_general_v42 --aspect 16:9
```

## 安装到多个 Agent

执行：

```bash
bash scripts/install_links.sh
```

默认会把这个 skill 软链接安装到：

- `~/.agents/skills`
- `~/.claude/skills`
- `~/.opencode/skills`
- `~/.workbuddy/skills`
- `~/.codebuddy/skills`

## 配置

修改 [config.json](./config.json)：

- `default_model`
- `default_aspect`
- `default_output_format`
- `default_workspace`
- `runtime_source_mode`
- `runtime_pinned_commit`

## 说明

- 首次运行会真实消耗即梦额度
- 使用前请先在浏览器登录 `https://jimeng.jianying.com`
- 浏览器插件需要用户手动加载 unpacked 目录
