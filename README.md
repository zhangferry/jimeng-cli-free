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
- 🆓 理论上只要你的即梦账号还有积分，就可以继续生成图片
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

## 🧭 后续开发计划

1. 添加图生图 / 图片编辑功能
2. 持续修复 bug 与稳定性问题
3. 添加视频生成功能

说明：
- 为了和图片生成能力解耦，视频生成功能大概率会单独做成一个新的插件，请期待

## ⚠️ 重要提醒

- 本项目全部代码采用 `vibe coding` 方式完成，主要使用 `GLM 5.1` 模型
- 当前代码**没有经过完整人工审核**，因此仍然可能存在未知 bug、边界问题和平台兼容性问题
- 本项目目前在 **macOS** 上完成了真实测试并验证可用
- **Windows** 和 **Linux** 理论上也可以使用，但由于各平台的终端、浏览器调用方式和路径处理差异，可能出现未知问题
- 如果你在 Windows 或 Linux 上遇到问题，欢迎提 PR，或者直接使用 Claude、Codex、GLM 5.1 等 AI 工具辅助排查和修复
- AI 时代，善用 AI

## 🛠️ 故障排查

如果运行出现问题，建议优先检查：

1. 浏览器是否正确安装并正常打开
2. 浏览器插件是否已经正确加载
3. 即梦网页端是否已经登录
4. 当前账号是否还有可用积分
5. 当前网络是否能正常访问 GitHub、即梦和插件相关资源
6. `node`、`npm`、`git`、`gh`、`curl`、`tar`、`unzip` 是否都已安装
7. 是否在 macOS 以外平台运行；如果是，请优先怀疑平台兼容性问题

额外建议：

- 首次使用时，先执行一次 `bash bin/jimeng-image ensure`
- 如果插件刚安装，先完全关闭并重新打开浏览器再试
- 如果页面卡住或没返回结果，先检查浏览器窗口里即梦页面是否仍处于可操作状态
- 如果输出目录没有新图片，先看 `result.stderr.log` 和 `result.json`

## ⚖️ 许可证与致谢

- 本项目采用 [Apache-2.0](./LICENSE)
- 本项目包含基于上游项目修改而来的衍生代码，详见 [NOTICE](./NOTICE)
- 上游来源与归属说明已保留，以避免许可证适用错误
