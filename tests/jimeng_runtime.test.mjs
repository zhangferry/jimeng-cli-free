import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const helperUrl = new URL('../overrides/jimeng/runtime.js', import.meta.url);
const helperSource = await readFile(helperUrl, 'utf8');
const runtime = await import(`data:text/javascript;base64,${Buffer.from(helperSource).toString('base64')}`);
const aspectUrl = new URL('../overrides/jimeng/aspect.js', import.meta.url);
const aspectSource = await readFile(aspectUrl, 'utf8');
const aspect = await import(`data:text/javascript;base64,${Buffer.from(aspectSource).toString('base64')}`);

test('captures the webpack require callback through the loadable chunk array', () => {
  const expectedRequire = () => {};
  const chunks = {
    push([, , callback]) {
      callback(expectedRequire);
    },
  };
  assert.equal(runtime.captureWebpackRuntime(chunks, 'test'), expectedRequire);
});

test('discovers React service providers and generation records once', () => {
  const service = { invokeFunction() {} };
  const record = {
    uniqueKey: 'new-record',
    workspaceId: 42,
    type: 'image',
    items: [{ imageUri: 'tos/example' }],
  };
  const fiber = {
    memoizedProps: { value: service, nested: { record } },
    pendingProps: null,
    return: null,
  };
  const element = { __reactFiberForTest: fiber };
  const root = {
    defaultView: { Node: class FakeNode {} },
    querySelectorAll: () => [element],
  };

  const result = runtime.inspectReactRuntime(root, {
    recordFilter: (value) => runtime.isGenerationRecord(value, 42),
  });
  assert.deepEqual(result.records, [record]);
  assert.deepEqual(result.serviceCandidates, [service]);
});

test('rejects prior records when two generations share one workspace', () => {
  const prior = {
    uniqueKey: 'prior-record',
    workspaceId: 42,
    type: 'image',
    items: [{}],
    generateTimeInfo: { createdTime: 10_000 },
  };
  const current = {
    ...prior,
    uniqueKey: 'current-record',
    generateTimeInfo: { createdTime: 20_100 },
  };
  const options = {
    workspaceId: 42,
    startedAt: 20_000,
    existingRecordKeys: new Set(['prior-record']),
  };

  assert.equal(runtime.isNewGenerationRecord(prior, options), false);
  assert.equal(runtime.isNewGenerationRecord(current, options), true);
});

test('applies 1:1 through the native manager and validates generated args', () => {
  const calls = [];
  const agent = {
    imageSettingsManager: {
      metadata: { modelOptions: [{ value: 'model-v1' }] },
      selectAspectRatio(value) { calls.push(['aspect', value]); },
      switchModel(value) { calls.push(['model', value]); },
    },
    setManualSettingsEnabled(value) { calls.push(['manual', value]); },
    switchSettingsType(value) { calls.push(['settings', value]); },
    taskSubmissionManager: {
      getCurrentGenerateArgs: () => ({
        imageArgs: { imageRatioType: 1, intelligentRatio: false },
      }),
    },
  };

  const result = runtime.applyNativeImageSettings(agent, {
    aspect: '1:1',
    model: 'model-v1',
    ratioTypes: aspect.ASPECT_RATIO_TYPE_MAP,
    validateImageArgs: aspect.validateNativeImageArgs,
  });
  assert.equal(result.valid, true);
  assert.deepEqual(calls, [
    ['settings', 'image'],
    ['model', 'model-v1'],
    ['manual', true],
    ['aspect', '1:1'],
  ]);
});

test('resolves imageUri values through the original-image service', async () => {
  const requested = [];
  const service = {
    async getUrlByUris(options) {
      requested.push(options);
      return {
        ok: true,
        value: {
          uri2Image: {
            'tos/one': { imageUrl: 'https://example.test/one~resize:0:0.image' },
            'tos/two': { imageUrl: 'https://example.test/two~resize:0:0.image' },
          },
        },
      };
    },
  };

  const result = await runtime.resolveOriginalImageUrls(service, ['tos/one', 'tos/two']);
  assert.deepEqual(requested, [{ uris: ['tos/one', 'tos/two'] }]);
  assert.deepEqual(result, {
    ok: true,
    urls: [
      'https://example.test/one~resize:0:0.image',
      'https://example.test/two~resize:0:0.image',
    ],
  });
});

test('keeps webpack module ids behind semantic names', () => {
  assert.deepEqual({ ...runtime.JIMENG_WEBPACK_MODULE_IDS }, {
    contentGeneratorToken: 610711,
    materialDataToken: 254094,
  });
});
