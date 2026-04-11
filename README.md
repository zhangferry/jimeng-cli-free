# jimeng-image-gen-opencli

[中文说明](./README.zh-CN.md)

Generate images on the Dreamina web app with model and aspect controls, stable browser-side automation, original image download, and automatic `webp -> png/jpg` conversion.

## Highlights

- Works with the Dreamina web app without requiring a high-tier membership
- Using the lowest Dreamina membership is recommended for a smoother generation experience
- Supports these models:
  - `high_aes_general_v50`: Image 5.0 Lite
  - `high_aes_general_v42`: Image 4.6
  - `high_aes_general_v45`: Image 4.5
  - `high_aes_general_v41`: Image 4.1
  - `high_aes_general_v40`: Image 4.0
- Supports these aspect ratios:
  - `smart`
  - `21:9`
  - `16:9`
  - `3:2`
  - `4:3`
  - `1:1`
  - `3:4`
  - `2:3`
  - `9:16`
- Downloads all 4 generated images into the local `output/` folder
- Converts downloaded images to `png` by default, with optional `jpg` or `webp`
- Ships as an MIT-licensed open source project

## Requirements

- macOS
- `node`, `npm`, `git`, `gh`, `curl`, `tar`, `unzip`
- Google Chrome or Microsoft Edge
- The required browser bridge extension must be installed manually
- A logged-in Dreamina web session in your browser

## Quick Start

1. Clone the repository

```bash
git clone https://github.com/leigegehaha/jimeng-image-gen-opencli.git
cd jimeng-image-gen-opencli
```

2. Prepare the environment

```bash
bash bin/jimeng-image ensure
```

3. Generate images

```bash
bash bin/jimeng-image generate "Green glass architecture with plants, landscape poster" --model high_aes_general_v42 --aspect 16:9
```

## Install Into Agents

```bash
bash scripts/install_links.sh
```

This links the skill into:

- `~/.agents/skills`
- `~/.claude/skills`
- `~/.opencode/skills`
- `~/.workbuddy/skills`
- `~/.codebuddy/skills`

## Configuration

Edit [config.json](./config.json):

- `default_model`
- `default_aspect`
- `default_output_format`
- `default_workspace`
- `runtime_source_mode`
- `runtime_pinned_commit`

## Notes

- The first run consumes Dreamina credits
- Log in to `https://jimeng.jianying.com` before use
- The browser extension must be loaded manually from the unpacked directory

## License

[MIT](./LICENSE)
