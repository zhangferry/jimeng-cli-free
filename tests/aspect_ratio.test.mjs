import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const helperUrl = new URL('../overrides/jimeng/aspect.js', import.meta.url);
const helperSource = await readFile(helperUrl, 'utf8');
const helperModule = await import(`data:text/javascript;base64,${Buffer.from(helperSource).toString('base64')}`);

const {
  ASPECT_RATIO_TYPE_MAP,
  matchesAspectDimensions,
  validateNativeImageArgs,
} = helperModule;

test('maps every fixed aspect ratio to Jimeng native image_ratio_type', () => {
  assert.deepEqual({ ...ASPECT_RATIO_TYPE_MAP }, {
    '1:1': 1,
    '3:4': 2,
    '16:9': 3,
    '4:3': 4,
    '9:16': 5,
    '2:3': 6,
    '3:2': 7,
    '21:9': 8,
  });
});

test('requires fixed ratios to disable intelligent ratio', () => {
  assert.equal(validateNativeImageArgs('1:1', {
    imageRatioType: 1,
    intelligentRatio: false,
  }), true);
  assert.equal(validateNativeImageArgs('1:1', {
    imageRatioType: 1,
    intelligentRatio: true,
  }), false);
  assert.equal(validateNativeImageArgs('1:1', {
    imageRatioType: 5,
    intelligentRatio: false,
  }), false);
});

test('requires smart ratio to enable intelligent ratio', () => {
  assert.equal(validateNativeImageArgs('smart', { intelligentRatio: true }), true);
  assert.equal(validateNativeImageArgs('smart', { intelligentRatio: false }), false);
});

test('validates original dimensions against the requested aspect', () => {
  assert.equal(matchesAspectDimensions('1:1', 2048, 2048), true);
  assert.equal(matchesAspectDimensions('1:1', 1152, 2048), false);
  assert.equal(matchesAspectDimensions('16:9', 2400, 1350), true);
  assert.equal(matchesAspectDimensions('3:4', 1536, 2048), true);
  assert.equal(matchesAspectDimensions('smart', 1376, 2048), true);
});
