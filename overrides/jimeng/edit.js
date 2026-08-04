// Derived from the jimeng browser adapter flow in jackwener/opencli (Apache-2.0).
// Modified in this repository to add local image based edit/reference workflows.
import { cli, Strategy } from '@jackwener/opencli/registry';
import { JIMENG_DOMAIN, buildJimengGenerateFunc } from './_shared.js';

cli({
  site: 'jimeng',
  name: 'edit',
  description: '即梦AI 图片编辑/参考图改图 — 输入本地图片和 prompt 生成新图片',
  domain: JIMENG_DOMAIN,
  strategy: Strategy.COOKIE,
  browser: true,
  timeoutSeconds: 300,
  args: [
    { name: 'image', type: 'string', required: true, positional: true, help: '本地参考图片路径' },
    { name: 'prompt', type: 'string', required: true, positional: true, help: '编辑提示词 prompt' },
    {
      name: 'model',
      type: 'string',
      default: 'high_aes_general_v47',
      help: '模型: high_aes_general_v47 (4.7), high_aes_general_v50 (5.0 Lite), high_aes_general_v42 (4.6), high_aes_general_v45 (4.5), high_aes_general_v41 (4.1), high_aes_general_v40 (4.0)',
    },
    {
      name: 'aspect',
      type: 'string',
      default: '9:16',
      help: '图片比例: smart, 21:9, 16:9, 3:2, 4:3, 1:1, 3:4, 2:3, 9:16',
    },
    {
      name: 'workspace',
      type: 'string',
      default: '0',
      help: '工作区 ID；默认使用 workspace=0',
    },
    { name: 'wait', type: 'int', default: 40, help: '等待生成完成的秒数' },
    { name: 'generate_count', type: 'int', default: 1, help: '每次生成图片数量，默认 1' },
    { name: 'mode', type: 'string', default: 'edit', help: '编辑模式，默认 edit；若页面未命中编辑入口会回退到 reference' },
  ],
  columns: ['status', 'prompt', 'image_count', 'image_urls', 'mode', 'reference_file'],
  func: buildJimengGenerateFunc({ defaultMode: 'edit', requireReference: true }),
});
