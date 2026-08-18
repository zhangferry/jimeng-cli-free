import * as fs from 'node:fs';
import * as path from 'node:path';
import { ArgumentError, AuthRequiredError, CommandExecutionError } from '@jackwener/opencli/errors';
import {
  ASPECT_RATIO_TYPE_MAP,
  matchesAspectDimensions,
  validateNativeImageArgs,
} from './aspect.js';
import {
  applyNativeImageSettings,
  captureWebpackRuntime,
  inspectReactRuntime,
  isGenerationRecord,
  isNewGenerationRecord,
  JIMENG_WEBPACK_TOKEN_SPECS,
  resolveWebpackToken,
  resolveOriginalImageUrls,
} from './runtime.js';

export const JIMENG_DOMAIN = 'jimeng.jianying.com';
export const JIMENG_GENERATE_URL = 'https://jimeng.jianying.com/ai-tool/home/';

const MODEL_MAP = {
  high_aes_general_v47: '图片4.7',
  high_aes_general_v50: '图片5.0 Lite',
  high_aes_general_v42: '图片4.6',
  high_aes_general_v45: '图片4.5',
  high_aes_general_v41: '图片4.1',
  high_aes_general_v40: '图片4.0',
};

const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function detectImageExtensionFromBuffer(buffer) {
  if (!buffer || buffer.length < 12) return '';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return '.png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return '.webp';
  return '';
}

function normalizeMode(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'generate' || raw === 'text' || raw === 'txt2img') return 'text';
  if (raw === 'reference' || raw === 'ref' || raw === 'image' || raw === 'image-to-image' || raw === 'img2img') return 'reference';
  if (raw === 'edit' || raw === 'editor') return 'edit';
  return raw;
}

function resolveReferencePath(input, required) {
  const raw = String(input || '').trim();
  if (!raw) {
    if (required) {
      throw new ArgumentError('需要提供参考图片路径', '请传入本地图片路径，例如 --reference ./image.png');
    }
    return '';
  }
  const resolved = path.resolve(raw);
  if (!fs.existsSync(resolved)) {
    throw new ArgumentError(`参考图片不存在: ${resolved}`);
  }
  let ext = path.extname(resolved).toLowerCase();
  if (!ext || !SUPPORTED_IMAGE_EXTENSIONS.has(ext)) {
    try {
      const header = fs.readFileSync(resolved).subarray(0, 16);
      const inferred = detectImageExtensionFromBuffer(header);
      if (SUPPORTED_IMAGE_EXTENSIONS.has(inferred)) {
        ext = inferred;
      }
    } catch {}
  }
  if (!SUPPORTED_IMAGE_EXTENSIONS.has(ext)) {
    throw new ArgumentError(`不支持的参考图片格式: ${ext}`, '支持 .jpg .jpeg .png .webp');
  }
  return resolved;
}

async function ensureGeneratePage(page, workspace) {
  // 检查当前页面是否已经在即梦首页，避免重复导航
  const currentUrl = await page.evaluate(`(() => location.href)()`).catch(() => '');
  if (currentUrl && currentUrl.includes('jimeng.jianying.com')) {
    await page.wait({ time: 2 });
    return;
  }
  // 页面不在即梦，执行导航
  await page.goto(JIMENG_GENERATE_URL);
  await page.wait({ time: 5 });
  // 验证导航是否成功
  const afterUrl = await page.evaluate(`(() => location.href)()`).catch(() => '');
  if (!afterUrl || !afterUrl.includes('jimeng.jianying.com')) {
    // 重试一次
    await page.wait({ time: 2 });
    await page.goto(JIMENG_GENERATE_URL);
    await page.wait({ time: 5 });
  }
}

async function ensureLoggedIn(page) {
  const state = await page.evaluate(`(() => {
    const normalize = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const pathName = location.pathname || '';
    const bodyText = normalize(document.body?.innerText || '');
    const password = document.querySelector('input[type="password"]');
    const loginButton = Array.from(document.querySelectorAll('button,[role="button"],a')).find((el) => {
      const text = normalize(el.textContent || el.getAttribute?.('aria-label') || '');
      return /登录|立即登录|log in|login|sign in/i.test(text);
    });
    return {
      loggedIn: !/login|passport/.test(pathName) && !password && !loginButton && !/扫码登录|手机号登录/.test(bodyText),
      href: location.href,
    };
  })()`);
  if (!state?.loggedIn) {
    throw new AuthRequiredError('即梦未登录', '请先在 Chrome 或 Edge 的 jimeng.jianying.com 中登录后再重试');
  }
}

async function prepareComposer(page, { prompt, aspect, model }) {
  // 重试包装：页面可能仍在加载/重定向
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await page.evaluate(`(async () => {
        const prompt = ${JSON.stringify(prompt)};
        const aspect = ${JSON.stringify(aspect)};
        const modelArg = ${JSON.stringify(model)};
        const modelMap = ${JSON.stringify(MODEL_MAP)};
        const ratioTypes = ${JSON.stringify(ASPECT_RATIO_TYPE_MAP)};
        const runtimeTokenSpecs = ${JSON.stringify(JIMENG_WEBPACK_TOKEN_SPECS)};
        const applyImageSettings = ${applyNativeImageSettings.toString()};
        const captureRuntime = ${captureWebpackRuntime.toString()};
        const inspectRuntime = ${inspectReactRuntime.toString()};
        const resolveRuntimeToken = ${resolveWebpackToken.toString()};
        const validateImageArgs = ${validateNativeImageArgs.toString()};
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const normalize = (s) => (s || '').replace(/\\s+/g, ' ').trim();
        const isVisible = (el) => {
          if (!(el instanceof HTMLElement)) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
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
        const setTextareaValue = (textarea, value) => {
          textarea.focus();
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          if (nativeSetter) {
            nativeSetter.call(textarea, value);
          } else {
            textarea.value = value;
          }
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        };
        const maybeDismiss = () => {
          const labels = ['回到底部', '我知道了', '知道了', '稍后再说', '关闭'];
          for (const label of labels) {
            const node = visible(Array.from(document.querySelectorAll('button,[role="button"]')))
              .find((el) => normalize(el.textContent) === label);
            if (node) node.click();
          }
        };
        const findPromptEditor = () => {
          // 新版即梦：优先查找 textarea
          const textareas = visible(Array.from(document.querySelectorAll('textarea')));
          if (textareas.length > 0) {
            return { type: 'textarea', el: textareas[0] };
          }
          // 旧版即梦：查找 contenteditable 编辑器
          const editors = visible(Array.from(document.querySelectorAll('[contenteditable="true"][role="textbox"], [contenteditable="true"]')));
          const editor = editors
            .sort((a, b) => {
              const aRect = a.getBoundingClientRect();
              const bRect = b.getBoundingClientRect();
              return bRect.width * bRect.height - aRect.width * aRect.height;
            })
            .find((el) => {
              const text = normalize(el.textContent);
              return !text || /上传参考图|输入文字|主体|描述你想生成/.test(text) || el.getBoundingClientRect().y > window.innerHeight / 2;
            }) || editors.at(-1) || null;
          return editor ? { type: 'contenteditable', el: editor } : null;
        };

        maybeDismiss();
        const editorInfo = findPromptEditor();
        if (!editorInfo) return { ok: false, reason: 'prompt-editor-not-found' };
        if (editorInfo.type === 'textarea') {
          setTextareaValue(editorInfo.el, prompt);
        } else {
          setEditorText(editorInfo.el, prompt);
        }
        await sleep(0.8 * 1000);

        // 模型选择：旧版 UI 有 combobox，新版可能没有，找不到就跳过
        const modelLabel = modelMap[modelArg] || modelArg;
        const modelCombo = visible(Array.from(document.querySelectorAll('[role="combobox"]'))).find((el) => {
          const text = normalize(el.textContent);
          return /图片\\s?(5\\.0 Lite|4\\.7|4\\.6|4\\.5|4\\.1|4\\.0|3\\.0)/.test(text);
        });
        if (modelCombo) {
          modelCombo.click();
          await sleep(500);
          const options = Array.from(document.querySelectorAll('[role="option"], li[role="option"]'));
          const matched = options.find((el) => normalize(el.textContent).includes(modelLabel));
          if (matched instanceof HTMLElement) {
            matched.click();
            await sleep(500);
          }
        }

        // 新版即梦由应用状态管理器构造最终 generateArgs。直接调用同一管理器，
        // 避免隐藏 radio、重复编辑器和 AB 实验布局只改变表面 UI 状态。
        const runtimeRequire = captureRuntime(self.__LOADABLE_LOADED_CHUNKS__, 'native-settings');
        if (!runtimeRequire) return { ok: false, reason: 'webpack-runtime-not-found' };

        const contentGeneratorToken = resolveRuntimeToken(
          runtimeRequire,
          runtimeTokenSpecs.contentGeneratorToken,
        );
        if (!contentGeneratorToken) return { ok: false, reason: 'content-generator-token-not-found' };

        const { serviceCandidates } = inspectRuntime(document, { fiberDepth: 250, objectDepth: 0 });

        let contentGenerator = null;
        for (const service of serviceCandidates) {
          try {
            const candidate = service.invokeFunction((accessor) => accessor.get(contentGeneratorToken));
            if (candidate?.agenticGeneratorManager) {
              contentGenerator = candidate;
              break;
            }
          } catch {}
        }
        if (!contentGenerator) return { ok: false, reason: 'content-generator-service-not-found' };

        const { generateArgs, valid } = applyImageSettings(contentGenerator.agenticGeneratorManager, {
          aspect,
          model: modelArg,
          ratioTypes,
          validateImageArgs,
        });
        if (!valid) {
          return {
            ok: false,
            reason: aspect === 'smart'
              ? 'native-smart-ratio-not-applied'
              : 'native-aspect-ratio-not-applied',
            aspect,
            generateArgs,
          };
        }

        return { ok: true };
      })()`);

      if (!result?.ok) {
        throw new CommandExecutionError('即梦输入区初始化失败', JSON.stringify(result || { reason: 'unknown' }));
      }
      return;
    } catch (err) {
      lastError = err;
      // 页面可能在重定向，等待后重试
      await page.wait({ time: 2 });
    }
  }
  throw lastError;
}

async function tryActivateMode(page, preferredMode) {
  if (preferredMode !== 'edit') {
    return preferredMode === 'reference' ? 'reference' : 'text';
  }
  const result = await page.evaluate(`(() => {
    const normalize = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const labels = ['图片编辑', '编辑图片', 'AI编辑', '重绘', '局部重绘'];
    const candidates = Array.from(document.querySelectorAll('button,[role="button"],label,a'))
      .filter((el) => isVisible(el))
      .map((el) => ({ el, text: normalize(el.textContent || el.getAttribute?.('aria-label') || '') }))
      .filter((item) => item.text && labels.some((label) => item.text.includes(label)));
    const matched = candidates[0]?.el || null;
    if (matched instanceof HTMLElement) {
      matched.click();
      return { applied: 'edit' };
    }
    return { applied: 'reference' };
  })()`);
  return result?.applied || 'reference';
}

async function prepareReferenceInput(page, preferredMode) {
  const baseline = await page.evaluate(`(() => Array.from(document.querySelectorAll('input[type="file"]')).length)()`);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await page.evaluate(`(() => {
      const baseline = ${JSON.stringify(baseline)};
      const preferredMode = ${JSON.stringify(preferredMode)};
      const normalize = (s) => (s || '').replace(/\\s+/g, ' ').trim();
      const isVisible = (el) => {
        if (!(el instanceof HTMLElement)) return false;
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const clickByLabels = (labels) => {
        const nodes = Array.from(document.querySelectorAll('button,[role="button"],label,a,div'));
        for (const label of labels) {
          const matched = nodes.find((el) => {
            if (!(el instanceof HTMLElement) || !isVisible(el)) return false;
            return normalize(el.textContent || el.getAttribute?.('aria-label') || '').includes(label);
          });
          if (matched instanceof HTMLElement) {
            matched.click();
            return true;
          }
        }
        return false;
      };

      const modeLabels = preferredMode === 'edit'
        ? ['图片编辑', '编辑图片', 'AI编辑', '重绘', '局部重绘']
        : ['上传参考图', '参考图', '参考图片', '图片参考', '添加参考图', '上传图片'];
      clickByLabels(modeLabels);
      clickByLabels(['上传参考图', '参考图', '参考图片', '图片参考', '添加参考图', '上传图片', '本地上传']);

      const inputs = Array.from(document.querySelectorAll('input[type="file"]')).filter((el) => el instanceof HTMLInputElement && !el.disabled);
      const candidates = inputs
        .map((el, index) => ({ el, index, accept: (el.getAttribute('accept') || '').toLowerCase() }))
        .sort((a, b) => {
          const aScore = (a.index >= baseline ? 10 : 0) + (a.accept.includes('image') ? 5 : 0);
          const bScore = (b.index >= baseline ? 10 : 0) + (b.accept.includes('image') ? 5 : 0);
          return bScore - aScore || b.index - a.index;
        });

      const target = candidates[0]?.el || null;
      if (!(target instanceof HTMLInputElement)) {
        return { ok: false, reason: 'reference-input-missing' };
      }

      document
        .querySelectorAll('[data-opencli-jimeng-upload="1"]')
        .forEach((el) => el.removeAttribute('data-opencli-jimeng-upload'));
      target.setAttribute('data-opencli-jimeng-upload', '1');
      return {
        ok: true,
        selector: '[data-opencli-jimeng-upload="1"]',
      };
    })()`);
    if (result?.ok && result.selector) {
      return result.selector;
    }
    await page.wait({ time: 0.5 });
  }
  throw new CommandExecutionError('即梦参考图上传入口定位失败', '页面结构可能已变化，未找到可注入的 input[type="file"]');
}

async function waitForReferenceReady(page) {
  let sawProgress = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const state = await page.evaluate(`(() => {
      const normalize = (s) => (s || '').replace(/\\s+/g, ' ').trim();
      const bodyText = normalize(document.body?.innerText || '');
      const hasPreview = Array.from(document.querySelectorAll('img')).some((img) => {
        const src = img.getAttribute('src') || img.currentSrc || '';
        return src.startsWith('blob:') || src.includes('byteimg.com') || src.includes('data:image');
      });
      const busy = /上传中|处理中|识别中|分析中/.test(bodyText);
      return { hasPreview, busy };
    })()`);
    if (state?.busy) sawProgress = true;
    if (state?.hasPreview && (!state?.busy || sawProgress)) {
      return;
    }
    await page.wait({ time: 0.5 });
  }
}

async function clickGenerate(page) {
  const result = await page.evaluate(`(() => {
    const normalize = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const isVisible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const buttons = Array.from(document.querySelectorAll('button')).filter((el) => isVisible(el));
    const editors = Array.from(document.querySelectorAll('textarea,[contenteditable="true"][role="textbox"],[contenteditable="true"]'))
      .filter((el) => isVisible(el))
      .sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        return bRect.width * bRect.height - aRect.width * aRect.height;
      });
    for (const editor of editors) {
      let container = editor;
      for (let depth = 0; depth < 8 && container; depth += 1) {
        container = container.parentElement;
        if (!(container instanceof HTMLElement)) break;
        const submitButton = Array.from(container.querySelectorAll('button[class*="submit-button-"]'))
          .find((el) => isVisible(el) && !el.disabled);
        if (submitButton instanceof HTMLElement) {
          submitButton.click();
          return { ok: true };
        }
      }
    }
    const byLabel = buttons.find((el) => /^(生成|立即生成|开始生成)$/.test(normalize(el.textContent)));
    if (byLabel instanceof HTMLElement) {
      byLabel.click();
      return { ok: true };
    }
    const iconButton = buttons
      .map((el) => ({ el, rect: el.getBoundingClientRect(), text: normalize(el.textContent), svgCount: el.querySelectorAll('svg').length }))
      .filter((item) => item.svgCount > 0 && item.text === '' && item.rect.y > window.innerHeight / 2 && item.rect.width >= 32 && item.rect.height >= 32)
      .sort((a, b) => (b.rect.y - a.rect.y) || (b.rect.x - a.rect.x))[0]?.el || null;
    if (iconButton instanceof HTMLElement) {
      iconButton.click();
      return { ok: true };
    }
    // 新版即梦 UI：在 prompt 编辑器附近查找图标按钮（提交/生成按钮）
    const editor = editors[0] || null;
    if (editor) {
      const editorRect = editor.getBoundingClientRect();
      const excludeTexts = ['自动', '搜索', '我的发布', '取消', '确定', '保存', '上传', '下载'];
      let container = editor;
      for (let depth = 0; depth < 8 && container; depth += 1) {
        container = container.parentElement;
        if (!(container instanceof HTMLElement)) break;
        const allBtns = Array.from(container.querySelectorAll('button'))
          .filter((el) => isVisible(el));
        if (allBtns.length > 0) {
          // 选择带 SVG 且不含排除文字的按钮，优先选择编辑器下方且距离较远的（提交按钮通常在底部）
          const iconBtns = allBtns
            .map((el) => {
              const rect = el.getBoundingClientRect();
              const dy = rect.y - editorRect.y;
              return { el, rect, text: normalize(el.textContent), svgCount: el.querySelectorAll('svg').length, dy };
            })
            .filter((item) => item.svgCount > 0 && !excludeTexts.some((t) => item.text.includes(t)) && item.rect.width > 0 && item.rect.height > 0)
            // 优先选择编辑器下方的按钮（dy > 0），然后选择距离编辑器最远的
            .sort((a, b) => {
              if (a.dy > 0 && b.dy <= 0) return -1;
              if (a.dy <= 0 && b.dy > 0) return 1;
              return b.dy - a.dy;
            });
          if (iconBtns.length > 0 && iconBtns[0].el instanceof HTMLElement) {
            iconBtns[0].el.click();
            return { ok: true };
          }
        }
      }
    }
    return { ok: false, reason: 'generate-button-not-found' };
  })()`);
  if (!result?.ok) {
    throw new CommandExecutionError('即梦生成按钮未找到', result?.reason || 'unknown');
  }
}

async function snapshotGenerationRecordKeys(page) {
  return page.evaluate(`(() => {
    const inspectRuntime = ${inspectReactRuntime.toString()};
    const isGenerationRecord = ${isGenerationRecord.toString()};
    const workspaceId = Number(new URL(location.href).searchParams.get('workspace'));
    if (!workspaceId) return [];
    const { records } = inspectRuntime(document, {
      fiberDepth: 25,
      objectDepth: 8,
      maxVisited: 50000,
      recordFilter: (value) => isGenerationRecord(value, workspaceId),
    });
    return records.map((record) => record.uniqueKey).filter(Boolean);
  })()`);
}

async function collectGenerationResult(page, {
  prompt,
  aspect,
  waitSeconds,
  mode,
  referencePath,
  startedAt,
  existingRecordKeys,
}) {
  const inspectResult = async () => page.evaluate(`(async () => {
    const prompt = ${JSON.stringify(prompt)};
    const aspect = ${JSON.stringify(aspect)};
    const startedAt = ${JSON.stringify(startedAt)};
    const existingRecordKeys = new Set(${JSON.stringify(existingRecordKeys)});
    const runtimeTokenSpecs = ${JSON.stringify(JIMENG_WEBPACK_TOKEN_SPECS)};
    const captureRuntime = ${captureWebpackRuntime.toString()};
    const inspectRuntime = ${inspectReactRuntime.toString()};
    const isGenerationRecord = ${isGenerationRecord.toString()};
    const matchesNewGenerationRecord = ${isNewGenerationRecord.toString()};
    const resolveRuntimeToken = ${resolveWebpackToken.toString()};
    const resolveOriginalUrls = ${resolveOriginalImageUrls.toString()};
    const dimensionsMatchAspect = ${matchesAspectDimensions.toString()};
    const workspaceId = Number(new URL(location.href).searchParams.get('workspace'));
    if (!workspaceId) return null;

    const { records, serviceCandidates } = inspectRuntime(document, {
      fiberDepth: 25,
      objectDepth: 8,
      maxVisited: 50000,
      recordFilter: (value) => matchesNewGenerationRecord(value, {
        workspaceId,
        startedAt,
        existingRecordKeys,
      }),
    });

    const completed = records
      .filter((record) => record.state === 2
        && record.statusCode === 50
        && record.isGenerating === false
        && record.items.length > 0)
      .sort((a, b) => Number(a.generateTimeInfo?.createdTime || 0)
        - Number(b.generateTimeInfo?.createdTime || 0));
    const latest = completed.at(-1);
    if (!latest) return null;

    const turnRecords = completed.filter((record) => record.turnId === latest.turnId);
    const imageItems = turnRecords.flatMap((record) => record.items
      .filter((item) => item?.imageUri)
      .map((item) => ({
        imageUri: item.imageUri,
        rawWidth: Number(item.rawWidth || 0),
        rawHeight: Number(item.rawHeight || 0),
      })));
    if (imageItems.length === 0) return null;

    if (aspect !== 'smart') {
      const recordRatioMatches = turnRecords.every((record) =>
        record.imageRatioText === aspect && record.isIntelligentAspectRatio === false);
      const dimensionsMatch = imageItems.every((item) =>
        dimensionsMatchAspect(aspect, item.rawWidth, item.rawHeight));
      if (!recordRatioMatches || !dimensionsMatch) {
        return {
          status: 'invalid-ratio',
          actualRatios: turnRecords.map((record) => record.imageRatioText),
          dimensions: imageItems.map((item) => String(item.rawWidth) + 'x' + String(item.rawHeight)),
        };
      }
    }

    const webpack = captureRuntime(self.__LOADABLE_LOADED_CHUNKS__, 'original-image');
    if (!webpack) return { status: 'pending', reason: 'webpack-runtime-not-found' };

    const materialToken = resolveRuntimeToken(
      webpack,
      runtimeTokenSpecs.materialDataToken,
    );
    if (!materialToken) return { status: 'pending', reason: 'material-service-token-not-found' };

    let materialService = null;
    for (const service of serviceCandidates) {
      try {
        const candidate = service.invokeFunction((accessor) => accessor.get(materialToken));
        if (typeof candidate?.getUrlByUris === 'function') {
          materialService = candidate;
          break;
        }
      } catch {}
    }
    if (!materialService) return { status: 'pending', reason: 'material-service-not-found' };

    const imageUris = Array.from(new Set(imageItems.map((item) => item.imageUri)));
    const originalResult = await resolveOriginalUrls(materialService, imageUris);
    if (!originalResult.ok) return { status: 'pending', reason: originalResult.reason };
    const originalUrls = originalResult.urls;

    return {
      status: 'success',
      prompt: prompt.substring(0, 120),
      image_count: originalUrls.length,
      image_urls: originalUrls.join('\\n'),
    };
  })()`);

  const referenceFile = referencePath ? path.basename(referencePath) : '';
  let lastResult = null;
  for (let attempt = 0; attempt < waitSeconds; attempt += 1) {
    try {
      const result = await inspectResult();
      if (result?.status === 'invalid-ratio') {
        throw new CommandExecutionError(
          `即梦返回的原始图片比例不是 ${aspect}`,
          JSON.stringify(result),
        );
      }
      if (result) {
        lastResult = result;
        if (result.status === 'success') break;
      }
    } catch (error) {
      if (error instanceof CommandExecutionError) throw error;
      // Completed generations can re-render the page and detach CDP. The next
      // short poll lets Page.evaluate reattach to the current document.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const row = lastResult?.status === 'success'
    ? lastResult
    : {
        status: 'timeout',
        prompt: prompt.substring(0, 120),
        image_count: 0,
        image_urls: lastResult?.reason || 'No matching completed generation found',
      };
  return [{
    ...row,
    mode,
    reference_file: referenceFile,
  }];
}

async function injectGenerateCountInterceptor(page, generateCount) {
  if (!generateCount || generateCount < 1) return;
  await page.evaluate(`(() => {
    if (window.__jimengGenCountPatched) return;
    window.__jimengGenCountPatched = true;
    const targetCount = ${generateCount};

    const modifyBody = (bodyStr) => {
      try {
        const parsed = JSON.parse(bodyStr);
        let modified = false;
        // generate_count 放在 text2image_params 里才生效
        if (parsed.text2image_params && typeof parsed.text2image_params === 'object') {
          parsed.text2image_params.generate_count = targetCount;
          modified = true;
        } else {
          parsed.text2image_params = { generate_count: targetCount };
          modified = true;
        }
        // 顶层也设一份（有些版本可能支持）
        if ('generate_count' in parsed) {
          parsed.generate_count = targetCount;
        }
        if (parsed.core_param && typeof parsed.core_param === 'object') {
          parsed.core_param.generate_count = targetCount;
        }
        if (modified) return JSON.stringify(parsed);
      } catch {}
      return null;
    };

    // 拦截 fetch
    const origFetch = window.fetch;
    window.fetch = async function(input, init) {
      try {
        if (init && init.body) {
          const bodyStr = typeof init.body === 'string' ? init.body : String(init.body);
          const modified = modifyBody(bodyStr);
          if (modified) init.body = modified;
        }
      } catch {}
      return origFetch.call(this, input, init);
    };

    // 拦截 XMLHttpRequest
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body) {
      try {
        if (body && typeof body === 'string') {
          const modified = modifyBody(body);
          if (modified) body = modified;
        }
      } catch {}
      return origSend.call(this, body);
    };
  })()`);
}

export function buildJimengGenerateFunc(options = {}) {
  const defaultMode = normalizeMode(options.defaultMode || 'text');
  const requireReference = Boolean(options.requireReference);
  return async (page, kwargs) => {
    const prompt = String(kwargs.prompt || '').trim();
    if (!prompt) {
      throw new ArgumentError('prompt 必填');
    }

    const referencePath = resolveReferencePath(kwargs.reference || kwargs.image, requireReference);
    const requestedMode = normalizeMode(kwargs.mode || defaultMode || (referencePath ? 'reference' : 'text'));
    const mode = referencePath ? requestedMode : 'text';
    const model = String(kwargs.model || 'high_aes_general_v47').trim();
    const aspect = String(kwargs.aspect || '9:16').trim();
    const workspace = String(kwargs.workspace || '0').trim();
    const waitSeconds = Math.max(5, Number(kwargs.wait) || 40);
    const generateCount = Math.max(1, Number(kwargs.generate_count) || 1);

    await ensureGeneratePage(page, workspace);
    await ensureLoggedIn(page);
    await prepareComposer(page, { prompt, aspect, model });

    let appliedMode = mode;
    if (referencePath) {
      appliedMode = await tryActivateMode(page, mode);
      if (!page.setFileInput) {
        throw new CommandExecutionError('当前浏览器适配器不支持文件注入', '请更新浏览器插件后重试');
      }
      const selector = await prepareReferenceInput(page, appliedMode);
      await page.setFileInput([referencePath], selector);
      await waitForReferenceReady(page);
      await page.wait({ time: 0.5 });
    }

    await injectGenerateCountInterceptor(page, generateCount);
    const existingRecordKeys = await snapshotGenerationRecordKeys(page);
    const startedAt = Date.now();
    await clickGenerate(page);
    return collectGenerationResult(page, {
      prompt,
      aspect,
      waitSeconds,
      mode: appliedMode,
      referencePath,
      startedAt,
      existingRecordKeys,
    });
  };
}
