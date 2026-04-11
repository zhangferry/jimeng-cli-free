import { cli, Strategy } from '@jackwener/opencli/registry';
cli({
    site: 'jimeng',
    name: 'generate',
    description: '即梦AI 文生图 — 输入 prompt 生成图片',
    domain: 'jimeng.jianying.com',
    strategy: Strategy.COOKIE,
    browser: true,
    timeoutSeconds: 300,
    args: [
        { name: 'prompt', type: 'string', required: true, positional: true, help: '图片描述 prompt' },
        {
            name: 'model',
            type: 'string',
            default: 'high_aes_general_v50',
            help: '模型: high_aes_general_v50 (5.0 Lite), high_aes_general_v42 (4.6), high_aes_general_v40 (4.0)',
        },
        {
            name: 'aspect',
            type: 'string',
            default: '16:9',
            help: '图片比例: smart, 21:9, 16:9, 3:2, 4:3, 1:1, 3:4, 2:3, 9:16',
        },
        {
            name: 'workspace',
            type: 'string',
            default: '0',
            help: '工作区 ID；默认使用 workspace=0',
        },
        { name: 'wait', type: 'int', default: 40, help: '等待生成完成的秒数' },
    ],
    columns: ['status', 'prompt', 'image_count', 'image_urls'],
    pipeline: [
        { navigate: 'https://jimeng.jianying.com/ai-tool/generate?type=image&workspace=${{ args.workspace }}' },
        { wait: 3 },
        { evaluate: `(async () => {
  const prompt = \${{ args.prompt | json }};
  const aspect = \${{ args.aspect | json }};
  const modelArg = \${{ args.model | json }};
  const waitSec = \${{ args.wait }};

  const modelMap = {
    high_aes_general_v50: '图片5.0 Lite',
    high_aes_general_v42: '图片4.6',
    high_aes_general_v45: '图片4.5',
    high_aes_general_v41: '图片4.1',
    high_aes_general_v40: '图片4.0',
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const normalize = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const isVisible = (el) => {
    if (!(el instanceof HTMLElement)) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  const visible = (items) => items.filter((el) => isVisible(el));
  const setEditorText = (editor, value) => {
    editor.focus();
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.addRange(range);
    }
    document.execCommand('selectAll');
    document.execCommand('delete');
    editor.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = value;
    editor.appendChild(p);
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const maybeClickBackToBottom = async () => {
    const button = visible(Array.from(document.querySelectorAll('button'))).find((el) => normalize(el.textContent) === '回到底部');
    if (button) {
      button.click();
      await sleep(600);
    }
  };
  const findPromptEditor = () => {
    const editors = visible(Array.from(document.querySelectorAll('[contenteditable="true"][role="textbox"], [contenteditable="true"]')));
    return editors
      .sort((a, b) => b.getBoundingClientRect().y - a.getBoundingClientRect().y)
      .find((el) => {
        const text = normalize(el.textContent);
        return !text || /上传参考图|输入文字|主体/.test(text) || el.getBoundingClientRect().y > window.innerHeight / 2;
      }) || editors.at(-1) || null;
  };
  const findGenerateButton = () => {
    const buttons = visible(Array.from(document.querySelectorAll('button')));
    const candidates = buttons
      .map((el) => ({ el, rect: el.getBoundingClientRect(), text: normalize(el.textContent), svgCount: el.querySelectorAll('svg').length }))
      .filter((item) => item.svgCount > 0 && item.text === '' && item.rect.y > window.innerHeight / 2 && item.rect.width >= 32 && item.rect.height >= 32)
      .sort((a, b) => (b.rect.y - a.rect.y) || (b.rect.x - a.rect.x));
    return candidates[0]?.el || null;
  };
  const scoreImageUrl = (url, path = '') => {
    if (!url || !url.includes('dreamina-sign.byteimg.com')) return -1;
    let score = 0;
    const resizeMatch = url.match(/aigc_resize:(\\d+):(\\d+)/);
    if (resizeMatch) {
      score += Math.max(Number(resizeMatch[1]), Number(resizeMatch[2]));
    }
    const pathRes = path.match(/resolutionUrlMap\\.(\\d+)/);
    if (pathRes) {
      score += Number(pathRes[1]) + 5000;
    }
    if (path.includes('resolutionUrlMap')) score += 1000;
    if (path.endsWith('.url') || path.includes('.url')) score += 200;
    if (url.includes('format=.jpeg')) score -= 10;
    return score;
  };
  const collectObjectUrls = (root) => {
    const seen = new WeakSet();
    const found = [];
    const visit = (value, path, depth) => {
      if (!value || depth > 4) return;
      if (typeof value === 'string') {
        const score = scoreImageUrl(value, path);
        if (score >= 0) found.push({ url: value, score, path });
        return;
      }
      if (typeof value !== 'object' || seen.has(value)) return;
      seen.add(value);
      for (const key of Object.keys(value)) {
        let next;
        try {
          next = value[key];
        } catch {
          continue;
        }
        visit(next, path ? \`\${path}.\${key}\` : key, depth + 1);
      }
    };
    visit(root, '', 0);
    return found;
  };
  const extractBestImageUrl = (img) => {
    const candidates = [];
    const push = (url, path = '') => {
      const score = scoreImageUrl(url, path);
      if (score >= 0) candidates.push({ url, score, path });
    };

    push(img.getAttribute('src') || '', 'img.src');
    push(img.currentSrc || '', 'img.currentSrc');

    let current = img;
    for (let depth = 0; depth < 5 && current; depth += 1) {
      const reactProps = Object.getOwnPropertyNames(current)
        .filter((name) => name.startsWith('__reactProps') || name.startsWith('__reactFiber'));
      for (const propName of reactProps) {
        try {
          for (const item of collectObjectUrls(current[propName])) {
            candidates.push(item);
          }
        } catch {
        }
      }
      current = current.parentElement;
    }

    const dedup = new Map();
    for (const item of candidates) {
      const existing = dedup.get(item.url);
      if (!existing || item.score > existing.score) {
        dedup.set(item.url, item);
      }
    }
    return Array.from(dedup.values()).sort((a, b) => b.score - a.score)[0]?.url || '';
  };

  const modelLabel = modelMap[modelArg] || modelArg;
  const extractCard = () => {
    const target = normalize(prompt);
    const nodes = visible(Array.from(document.querySelectorAll('span, p, div')))
      .filter((el) => normalize(el.textContent) === target);
    const candidates = [];
    for (const node of nodes) {
      let current = node;
      for (let depth = 0; depth < 8 && current; depth += 1) {
        current = current.parentElement;
        if (!(current instanceof HTMLElement)) continue;
        const text = normalize(current.textContent);
        if (!text.includes(target)) continue;
        const urls = Array.from(current.querySelectorAll('img'))
          .map((img) => extractBestImageUrl(img))
          .filter((src) => src.includes('dreamina-sign.byteimg.com'));
        const hasProgress = /造梦中|生成中/.test(text);
        const hasResultActions = /重新编辑|再次生成/.test(text);
        const hasModel = text.includes(modelLabel);
        const hasAspect = aspect ? text.includes(aspect) : false;
        const isReferenceCard = /已找到\\d+张|灵感参考/.test(text);
        const score = (hasModel ? 3000 : 0)
          + (hasAspect ? 800 : 0)
          + (hasResultActions ? 500 : 0)
          + (hasProgress ? 300 : 0)
          + (urls.length === 4 ? 400 : 0)
          - (Math.abs(urls.length - 4) * 900)
          - text.length;
        if (urls.length > 0 || hasProgress || hasResultActions) {
          if (!isReferenceCard || hasModel || hasProgress || hasResultActions) {
            candidates.push({ urls, text, hasProgress, hasResultActions, score });
          }
        }
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  };

  await maybeClickBackToBottom();
  const editor = findPromptEditor();
  if (!editor) return [{ status: 'failed', prompt, image_count: 0, image_urls: 'Editor not found' }];

  setEditorText(editor, prompt);
  await sleep(800);

  const modelCombo = visible(Array.from(document.querySelectorAll('[role="combobox"]'))).find((el) => {
    const text = normalize(el.textContent);
    return /图片\\s?(5\\.0 Lite|4\\.6|4\\.5|4\\.1|4\\.0|3\\.0)/.test(text);
  });
  if (modelCombo) {
    modelCombo.click();
    await sleep(500);
    const options = Array.from(document.querySelectorAll('[role="option"], li[role="option"]'));
    const matched = options.find((el) => normalize(el.textContent).includes(modelLabel));
    if (matched) {
      matched.click();
      await sleep(500);
    }
  }

  if (aspect) {
    const aspectButton = visible(Array.from(document.querySelectorAll('button'))).find((el) => {
      const text = normalize(el.textContent);
      return /^(智能|21:9|16:9|3:2|4:3|1:1|3:4|2:3|9:16)/.test(text);
    });
    if (aspectButton) {
      aspectButton.click();
      await sleep(500);
      const ratioInput = Array.from(document.querySelectorAll('input[type="radio"]')).find((el) => {
        const value = el.getAttribute('value') || '';
        if (aspect === 'smart') return value === '';
        return value === aspect;
      });
      const ratioTarget = ratioInput?.closest('label') || ratioInput;
      if (ratioTarget instanceof HTMLElement) {
        ratioTarget.click();
        await sleep(400);
      }
    }
  }

  const generateButton = findGenerateButton();
  if (!generateButton) {
    return [{ status: 'failed', prompt, image_count: 0, image_urls: 'Generate button not found' }];
  }
  generateButton.click();

  let matchedCard = null;
  for (let i = 0; i < waitSec; i++) {
    await sleep(1000);
    const candidate = extractCard();
    if (!candidate) continue;
    matchedCard = candidate;
    if (candidate.urls.length > 0 && !candidate.hasProgress) break;
  }

  if (!matchedCard) {
    return [{ status: 'timeout', prompt, image_count: 0, image_urls: 'No matching history item found' }];
  }

  const urls = Array.from(new Set(matchedCard.urls)).slice(0, 4);
  const finalStatus = urls.length > 0 && !matchedCard.hasProgress ? 'success' : 'pending';

  return [{
    status: finalStatus,
    prompt: prompt.substring(0, 120),
    image_count: urls.length,
    image_urls: urls.join('\\n')
  }];
})()
` },
        { map: {
                status: '${{ item.status }}',
                prompt: '${{ item.prompt }}',
                image_count: '${{ item.image_count }}',
                image_urls: '${{ item.image_urls }}',
            } },
    ],
});
