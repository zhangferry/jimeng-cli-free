# 🎨 jimeng-image-gen-opencli

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS-black)](#-requirements)
[![Browser](https://img.shields.io/badge/Browser-Chrome%20%7C%20Edge-2ea44f)](#-requirements)
[![Dreamina](https://img.shields.io/badge/Dreamina-Web%20Image%20Gen-ff7a59)](#-highlights)

[🇨🇳 中文](./README.md)

A local skill focused on **image generation through the Dreamina web app**.  
It supports model selection, aspect ratio control, stable browser automation, original image download, and automatic `webp -> png/jpg` conversion.

## ✨ Highlights

- 🚀 Works with the Dreamina web app without requiring a high-tier membership
- 💡 Using the lowest Dreamina membership is recommended for a smoother generation experience
- 🖼️ Supports these models:
  - `high_aes_general_v50`: Image 5.0 Lite
  - `high_aes_general_v42`: Image 4.6
  - `high_aes_general_v45`: Image 4.5
  - `high_aes_general_v41`: Image 4.1
  - `high_aes_general_v40`: Image 4.0
- 📐 Supports these aspect ratios:
  - `smart`
  - `21:9`
  - `16:9`
  - `3:2`
  - `4:3`
  - `1:1`
  - `3:4`
  - `2:3`
  - `9:16`
- 📥 Downloads all 4 generated images into the local `output/` folder
- 🔄 Converts downloaded images to `png` by default, with optional `jpg` or `webp`
- 🔓 Licensed under **Apache-2.0**

## 🧰 Requirements

- macOS
- `node`, `npm`, `git`, `gh`, `curl`, `tar`, `unzip`
- Google Chrome or Microsoft Edge
- The browser bridge extension must be installed manually
- A logged-in Dreamina web session in your browser

## ⚡ Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/leigegehaha/jimeng-image-gen-opencli.git
cd jimeng-image-gen-opencli
```

### 2. Prepare the environment

```bash
bash bin/jimeng-image ensure
```

### 3. Generate images

```bash
bash bin/jimeng-image generate "Green glass architecture with plants, landscape poster" --model high_aes_general_v42 --aspect 16:9
```

## 🤖 Install Into Agents

```bash
bash scripts/install_links.sh
```

This links the skill into:

- `~/.agents/skills`
- `~/.claude/skills`
- `~/.opencode/skills`
- `~/.workbuddy/skills`
- `~/.codebuddy/skills`

## ⚙️ Configuration

Edit [config.json](./config.json):

- `default_model`
- `default_aspect`
- `default_output_format`
- `default_workspace`
- `runtime_source_mode`
- `runtime_pinned_commit`

## 📌 Notes

- The first run consumes Dreamina credits
- Log in to `https://jimeng.jianying.com` before use
- The browser extension must be loaded manually from the unpacked directory

## ⚖️ License And Attribution

- This project is licensed under [Apache-2.0](./LICENSE)
- This repository includes modified derivative work based on an upstream project; see [NOTICE](./NOTICE)
- Upstream attribution is retained to avoid license misapplication
