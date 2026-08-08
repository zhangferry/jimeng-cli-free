export const ASPECT_RATIO_TYPE_MAP = Object.freeze({
  '1:1': 1,
  '3:4': 2,
  '16:9': 3,
  '4:3': 4,
  '9:16': 5,
  '2:3': 6,
  '3:2': 7,
  '21:9': 8,
});

export function validateNativeImageArgs(aspect, imageArgs, ratioTypes = ASPECT_RATIO_TYPE_MAP) {
  if (aspect === 'smart') return imageArgs?.intelligentRatio === true;
  return imageArgs?.imageRatioType === ratioTypes[aspect]
    && imageArgs?.intelligentRatio === false;
}

export function matchesAspectDimensions(aspect, width, height, tolerance = 0.01) {
  if (aspect === 'smart') return true;
  const [ratioWidth, ratioHeight] = String(aspect).split(':').map(Number);
  const actualWidth = Number(width);
  const actualHeight = Number(height);
  if (!ratioWidth || !ratioHeight || !actualWidth || !actualHeight) return false;
  const expected = ratioWidth / ratioHeight;
  const actual = actualWidth / actualHeight;
  return Math.abs(actual - expected) / expected <= tolerance;
}
