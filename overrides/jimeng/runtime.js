export const JIMENG_WEBPACK_MODULE_IDS = Object.freeze({
  contentGeneratorToken: 72203,
  materialDataToken: 298706,
});

export const JIMENG_WEBPACK_TOKEN_SPECS = Object.freeze({
  contentGeneratorToken: Object.freeze({
    preferredModuleId: JIMENG_WEBPACK_MODULE_IDS.contentGeneratorToken,
    preferredExportName: 'V',
    semanticName: 'content-generator-feature-service',
  }),
  materialDataToken: Object.freeze({
    preferredModuleId: JIMENG_WEBPACK_MODULE_IDS.materialDataToken,
    preferredExportName: 'H',
    semanticName: 'dreamina-material-data-service',
  }),
});

export function captureWebpackRuntime(loadableChunks, label) {
  let runtimeRequire = null;
  if (!loadableChunks || typeof loadableChunks.push !== 'function') return null;
  try {
    loadableChunks.push([
      [`opencli-${label}-${Date.now()}`],
      {},
      (require) => { runtimeRequire = require; },
    ]);
  } catch {}
  return runtimeRequire;
}

export function resolveWebpackToken(runtimeRequire, {
  preferredModuleId,
  preferredExportName,
  semanticName,
}) {
  if (typeof runtimeRequire !== 'function' || !semanticName) return null;

  const matchesSemanticName = (value) => {
    if (value == null || typeof value === 'string') return false;
    try {
      return String(value) === semanticName;
    } catch {
      return false;
    }
  };
  const findTokenInExports = (moduleExports) => {
    if (!moduleExports) return null;
    if (preferredExportName && matchesSemanticName(moduleExports[preferredExportName])) {
      return moduleExports[preferredExportName];
    }
    for (const value of Object.values(moduleExports)) {
      if (matchesSemanticName(value)) return value;
    }
    return null;
  };
  const loadAndInspect = (moduleId) => {
    try {
      return findTokenInExports(runtimeRequire(moduleId));
    } catch {
      return null;
    }
  };

  const preferred = loadAndInspect(preferredModuleId);
  if (preferred) return preferred;

  for (const cachedModule of Object.values(runtimeRequire.c || {})) {
    const cached = findTokenInExports(cachedModule?.exports);
    if (cached) return cached;
  }

  for (const [moduleId, factory] of Object.entries(runtimeRequire.m || {})) {
    let source = '';
    try {
      source = Function.prototype.toString.call(factory);
    } catch {}
    if (!source.includes(semanticName)) continue;
    const discovered = loadAndInspect(moduleId);
    if (discovered) return discovered;
  }

  return null;
}

export function isGenerationRecord(value, workspaceId) {
  return Number(value?.workspaceId) === Number(workspaceId)
    && value?.type === 'image'
    && Array.isArray(value?.items)
    && Boolean(value?.uniqueKey);
}

export function isNewGenerationRecord(value, {
  workspaceId,
  startedAt,
  existingRecordKeys,
  clockTolerance = 5000,
}) {
  if (!isGenerationRecord(value, workspaceId)) return false;
  const knownKeys = existingRecordKeys instanceof Set
    ? existingRecordKeys
    : new Set(existingRecordKeys || []);
  const createdAt = Number(value.generateTimeInfo?.createdTime || 0);
  return !knownKeys.has(value.uniqueKey)
    && createdAt >= Number(startedAt) - clockTolerance;
}

export function applyNativeImageSettings(agent, {
  aspect,
  model,
  ratioTypes,
  validateImageArgs,
}) {
  const imageSettings = agent.imageSettingsManager;
  agent.switchSettingsType('image');
  if (imageSettings.metadata.modelOptions.some((option) => option.value === model)) {
    imageSettings.switchModel(model);
  }
  if (aspect === 'smart') {
    agent.setManualSettingsEnabled(false);
  } else {
    agent.setManualSettingsEnabled(true);
    imageSettings.selectAspectRatio(aspect);
  }

  const generateArgs = agent.taskSubmissionManager.getCurrentGenerateArgs();
  return {
    generateArgs,
    valid: validateImageArgs(aspect, generateArgs?.imageArgs, ratioTypes),
  };
}

export async function resolveOriginalImageUrls(materialService, imageUris) {
  if (typeof materialService?.getUrlByUris !== 'function') {
    return { ok: false, reason: 'material-service-not-found' };
  }
  const resolved = await materialService.getUrlByUris({ uris: imageUris });
  if (!resolved?.ok) return { ok: false, reason: 'original-image-resolution-failed' };
  const uriMap = resolved.value?.uri2Image || {};
  const urls = imageUris
    .map((uri) => uriMap[uri]?.imageUrl)
    .filter((url) => typeof url === 'string' && url.length > 0);
  if (urls.length !== imageUris.length) {
    return { ok: false, reason: 'original-image-url-missing' };
  }
  return { ok: true, urls };
}

export function inspectReactRuntime(root, options = {}) {
  const {
    fiberDepth = 50,
    objectDepth = 8,
    maxVisited = 50000,
    recordFilter = null,
  } = options;
  const records = new Map();
  const serviceCandidates = [];
  const seenFibers = new WeakSet();
  const seenObjects = new WeakSet();
  const seenServices = new WeakSet();
  const NodeConstructor = root?.defaultView?.Node || globalThis.Node;
  let visited = 0;

  const visit = (value, depth) => {
    if (!value
      || typeof value !== 'object'
      || depth > objectDepth
      || visited++ > maxVisited
      || seenObjects.has(value)
      || (NodeConstructor && value instanceof NodeConstructor)) {
      return;
    }
    seenObjects.add(value);

    if (typeof recordFilter === 'function' && recordFilter(value)) {
      if (value.uniqueKey) records.set(value.uniqueKey, value);
      return;
    }

    for (const key of Object.keys(value).slice(0, 200)) {
      if (['_owner', 'return', 'child', 'sibling', 'stateNode'].includes(key)
        || key.startsWith('__react')) {
        continue;
      }
      try {
        visit(value[key], depth + 1);
      } catch {}
    }
  };

  for (const element of root?.querySelectorAll?.('*') || []) {
    const fiberKey = Object.getOwnPropertyNames(element).find((key) => key.startsWith('__reactFiber'));
    let fiber = fiberKey ? element[fiberKey] : null;
    for (let depth = 0; fiber && depth < fiberDepth; depth += 1, fiber = fiber.return) {
      if (seenFibers.has(fiber)) break;
      seenFibers.add(fiber);
      for (const props of [fiber.memoizedProps, fiber.pendingProps]) {
        const service = props?.value;
        if (service && typeof service.invokeFunction === 'function' && !seenServices.has(service)) {
          seenServices.add(service);
          serviceCandidates.push(service);
        }
        visit(props, 0);
      }
    }
  }

  return { records: Array.from(records.values()), serviceCandidates };
}
