# jimeng-image-gen-opencli

[English README](./README.md)

这是一个用于驱动即梦网页端生图的本地 skill，支持模型选择、比例选择、稳定的浏览器自动化、原图下载，以及自动将 `webp` 转为 `png/jpg`。

## 项目特色

- 不需要开通即梦高阶会员，也可以直接使用即梦网页端生图
- 建议使用即梦最低会员，可获得更流畅的生图体验
- 支持以下模型：
  - `high_aes_general_v50`：图片5.0 Lite
  - `high_aes_general_v42`：图片4.6
  - `high_aes_general_v45`：图片4.5
  - `high_aes_general_v41`：图片4.1
  - `high_aes_general_v40`：图片4.0
- 支持以下比例：
  - `smart`
  - `21:9`
  - `16:9`
  - `3:2`
  - `4:3`
  - `1:1`
  - `3:4`
  - `2:3`
  - `9:16`
- 每次自动下载 4 张结果图到本地 `output/`
- 默认把下载结果转成 `png`，也可改成 `jpg` 或 `webp`
- 项目采用 MIT 开源协议

## 环境要求

- macOS
- `node`、`npm`、`git`、`gh`、`curl`、`tar`、`unzip`
- 已安装 Google Chrome 或 Microsoft Edge
- 需要手动安装浏览器桥接插件
- 浏览器中已登录即梦网页端

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

3. 开始生图

```bash
bash bin/jimeng-image generate "青绿色玻璃建筑与植物，横版海报" --model high_aes_general_v42 --aspect 16:9
```

## 安装到多个 Agent

```bash
bash scripts/install_links.sh
```

默认会把这个 skill 软链接安装到：

- `~/.agents/skills`
- `~/.claude/skills`
- `~/.opencode/skills`
- `~/.workbuddy/skills`
- `~/.codebuddy/skills`

## 配置项

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
- 浏览器插件需要从 unpacked 目录手动加载

## 协议

[MIT](./LICENSE)
