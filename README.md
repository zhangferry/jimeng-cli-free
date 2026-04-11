# 🎨 jimeng-image-gen-opencli

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS-black)](#-环境要求)
[![Browser](https://img.shields.io/badge/Browser-Chrome%20%7C%20Edge-2ea44f)](#-环境要求)
[![Dreamina](https://img.shields.io/badge/Dreamina-Web%20Image%20Gen-ff7a59)](#-项目特色)

[🇺🇸 English](./README.en.md)

一个专门用于**即梦网页端生图**的本地 skill。  
支持模型选择、比例选择、稳定自动化、原图下载，以及自动将 `webp` 转成 `png/jpg`。

![Workflow](./assets/flow-overview.svg)

## ✨ 项目特色

- 🚀 不需要开通即梦高阶会员，也可以直接使用即梦网页端生图
- 💡 建议使用即梦最低会员，可获得更流畅的生图体验
- 🖼️ 支持以下模型：
  - `high_aes_general_v50`：图片5.0 Lite
  - `high_aes_general_v42`：图片4.6
  - `high_aes_general_v45`：图片4.5
  - `high_aes_general_v41`：图片4.1
  - `high_aes_general_v40`：图片4.0
- 📐 支持以下比例：
  - `smart`
  - `21:9`
  - `16:9`
  - `3:2`
  - `4:3`
  - `1:1`
  - `3:4`
  - `2:3`
  - `9:16`
- 📥 每次自动下载 4 张结果图到本地 `output/`
- 🔄 默认把下载结果转成 `png`，也可改成 `jpg` 或 `webp`
- 🔓 项目采用 **Apache-2.0** 开源协议

## 🧰 环境要求

- macOS
- `node`、`npm`、`git`、`gh`、`curl`、`tar`、`unzip`
- 已安装 **Google Chrome** 或 **Microsoft Edge**
- 需要手动安装浏览器桥接插件
- 浏览器中已登录即梦网页端

## ⚡ 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/leigegehaha/jimeng-image-gen-opencli.git
cd jimeng-image-gen-opencli
```

### 2. 准备环境

```bash
bash bin/jimeng-image ensure
```

### 3. 开始生图

```bash
bash bin/jimeng-image generate "青绿色玻璃建筑与植物，横版海报" --model high_aes_general_v42 --aspect 16:9
```

## 🤖 安装到多个 Agent

```bash
bash scripts/install_links.sh
```

默认会把这个 skill 软链接安装到：

- `~/.agents/skills`
- `~/.claude/skills`
- `~/.opencode/skills`
- `~/.workbuddy/skills`
- `~/.codebuddy/skills`

## 🖼️ Demo

![Demo Board](./assets/demo-board.svg)

## ⚙️ 配置项

修改 [config.json](./config.json)：

- `default_model`
- `default_aspect`
- `default_output_format`
- `default_workspace`
- `runtime_source_mode`
- `runtime_pinned_commit`

## 📌 使用说明

- 首次运行会真实消耗即梦额度
- 使用前请先在浏览器登录 `https://jimeng.jianying.com`
- 浏览器插件需要从 unpacked 目录手动加载

## ⚖️ 许可证与致谢

- 本项目采用 [Apache-2.0](./LICENSE)
- 本项目包含基于上游项目修改而来的衍生代码，详见 [NOTICE](./NOTICE)
- 上游来源与归属说明已保留，以避免许可证适用错误
