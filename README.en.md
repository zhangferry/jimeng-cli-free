# 🎨 jimeng-cli-free

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS-black)](#-requirements)
[![Browser](https://img.shields.io/badge/Browser-Chrome%20%7C%20Edge-2ea44f)](#-requirements)
[![Dreamina](https://img.shields.io/badge/Dreamina-Web%20Image%20Gen-ff7a59)](#-highlights)

[🇨🇳 中文](./README.md)

A local skill focused on **image generation through the Dreamina web app**.  
It supports model selection, aspect ratio control, stable browser automation, reference-image upload, image editing, original image download, and automatic `webp -> png/jpg` conversion.

![Hero Banner](./assets/hero-banner.svg)

![Workflow](./assets/flow-overview.svg)

## ✨ Highlights

- 🚀 Works with the Dreamina web app without requiring a high-tier membership
- 🆓 In practice, image generation can remain effectively free as long as your Dreamina account still has usable credits
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
- 🖼️ Supports uploading reference images from:
  - local image files
  - image URLs
  - the system clipboard
- 💡 If you upload a reference image, the recommended models are:
  - `high_aes_general_v50`: Image 5.0 Lite
  - `high_aes_general_v42`: Image 4.6
  - `high_aes_general_v45`: Image 4.5
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
git clone https://github.com/leigegehaha/jimeng-cli-free.git
cd jimeng-cli-free
```

### 2. Prepare the environment

```bash
bash bin/jimeng-cli-free ensure
```

This step does two important things:

- Downloads the browser extension into the local `downloads/` directory
- Checks browser connectivity and Dreamina login state

After the download, the extension is typically located at:

- Zip file: `downloads/opencli-extension.zip`
- Unpacked directory: `downloads/opencli-extension/unpacked`

### 3. Manually load the browser extension

This is a critical first-run step.

#### Chrome

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this directory from the repository:

```bash
downloads/opencli-extension/unpacked
```

#### Edge

1. Open `edge://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this directory from the repository:

```bash
downloads/opencli-extension/unpacked
```

#### How to verify the extension is loaded

- You can see the extension on the browser extensions page
- The extension is enabled
- The browser should remain open with at least one window

If this step is missing or incorrect, later commands usually fail with errors such as:

- browser not connected
- extension not installed
- failed to extract page data

### 4. Log in to Dreamina

In the same browser where the extension was loaded, open:

- `https://jimeng.jianying.com`

Then log in and make sure the page is usable.

### 5. Generate images

```bash
bash bin/jimeng-cli-free generate "Green glass architecture with plants, landscape poster" --model high_aes_general_v42 --aspect 16:9
```

Reference-image upload is also supported:

```bash
bash bin/jimeng-cli-free generate "Keep the main composition, turn it into a cinematic poster" --reference ./ref.png --mode reference
bash bin/jimeng-cli-free generate "Keep the main composition, turn it into a cinematic poster" --reference https://example.com/ref.png --mode reference
bash bin/jimeng-cli-free generate "Keep the main composition, turn it into a cinematic poster" --clipboard --mode reference
```

For reference-image workflows, the recommended models are:

- `high_aes_general_v50`: Image 5.0 Lite
- `high_aes_general_v42`: Image 4.6
- `high_aes_general_v45`: Image 4.5

If you want to verify the environment again before generating, run:

```bash
bash bin/jimeng-cli-free ensure
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

## 🖼️ Demo

![Demo Board](./assets/demo-board.svg)

## ⚙️ Configuration

Edit [config.json](./config.json):

- `default_model`
- `default_aspect`
- `default_output_format`
- `default_workspace`
- `auto_create_workspace`
- `runtime_source_mode`
- `runtime_pinned_commit`

## 📌 Notes

- The first run consumes Dreamina credits
- Log in to `https://jimeng.jianying.com` before use
- The browser extension must be loaded manually from the unpacked directory
- If the extension is not loaded correctly, the project usually will not work

## 🧭 Roadmap

1. Keep improving reference-image generation and image editing
2. Continue fixing bugs and stability issues
3. Add video generation support

Note:
- Video generation will likely be developed as a separate plugin to keep it decoupled from image generation

## ⚠️ Important Notes

- This project was built entirely with `vibe coding`, mainly using the `GLM 5.1` model
- The code has **not gone through full human review**, so unknown bugs and edge cases may still exist
- The project has been tested successfully on **macOS**
- **Windows** and **Linux** should be possible in theory, but terminal behavior, browser invocation, and path handling may differ and introduce unknown bugs
- If something breaks on Windows or Linux, PRs are welcome, and using Claude, Codex, GLM 5.1, or other AI tools for diagnosis is encouraged
- In the AI era, use AI well

## 🛠️ Troubleshooting

If the project does not work as expected, check these first:

1. Is the browser installed correctly and currently open?
2. Is the browser extension installed and loaded correctly?
3. Are you logged in to Dreamina in that browser?
4. Does the account still have usable credits?
5. Can your network access GitHub, Dreamina, and extension-related resources?
6. Are `node`, `npm`, `git`, `gh`, `curl`, `tar`, and `unzip` installed?
7. Are you running on a non-macOS platform? If yes, treat platform differences as a likely cause first

Extra suggestions:

- Run `bash bin/jimeng-cli-free ensure` first
- If the extension was just installed, fully restart the browser once
- If you are not sure where the extension directory is, check `downloads/opencli-extension/unpacked`
- If the page appears stuck, inspect whether the Dreamina page is still interactive in the browser window
- If no new images appear in the output folder, inspect `result.stderr.log` and `result.json`

## ⚖️ License And Attribution

- This project is licensed under [Apache-2.0](./LICENSE)
- This repository includes modified derivative work based on an upstream project; see [NOTICE](./NOTICE)
- Upstream attribution is retained to avoid license misapplication

## 🌐 GitHub Presentation Notes

- The repository homepage already includes a workflow overview and demo board
- A dedicated social preview image is also included:
  - [assets/social-preview.svg](./assets/social-preview.svg)
- GitHub CLI does not currently expose direct social preview image configuration, so uploading this file manually in repository settings is recommended
