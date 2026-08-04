(async () => {
  const bgImg = document.getElementById('captcha_verify_image');
  const slideImg = document.getElementById('captcha-verify_img_slide');
  if (!bgImg || !slideImg) return JSON.stringify({error: 'captcha images not found'});

  const bgUrl = bgImg.src;
  const slideUrl = slideImg.src;

  const loadImg = (url) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('load failed: ' + url.slice(0, 80)));
    img.src = url;
  });

  let bg, slide;
  try { bg = await loadImg(bgUrl); } catch(e) { return JSON.stringify({error: 'bg load failed', url: bgUrl.slice(0, 100)}); }
  try { slide = await loadImg(slideUrl); } catch(e) { return JSON.stringify({error: 'slide load failed', url: slideUrl.slice(0, 100)}); }

  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = bg.naturalWidth;
  bgCanvas.height = bg.naturalHeight;
  const bgCtx = bgCanvas.getContext('2d');
  bgCtx.drawImage(bg, 0, 0);
  const bgData = bgCtx.getImageData(0, 0, bgCanvas.width, bgCanvas.height);

  const slideCanvas = document.createElement('canvas');
  slideCanvas.width = slide.naturalWidth;
  slideCanvas.height = slide.naturalHeight;
  const slideCtx = slideCanvas.getContext('2d');
  slideCtx.drawImage(slide, 0, 0);
  const slideData = slideCtx.getImageData(0, 0, slideCanvas.width, slideCanvas.height);

  const bgW = bgCanvas.width;
  const bgH = bgCanvas.height;
  const slideW = slideCanvas.width;

  // Detect cutout: scan columns and find the region with significant brightness change
  // The cutout is typically a darker or shadowed area
  const colBrightness = [];
  for (let x = 0; x < bgW; x++) {
    let sum = 0, count = 0;
    for (let y = 0; y < bgH; y++) {
      const idx = (y * bgW + x) * 4;
      const r = bgData.data[idx];
      const g = bgData.data[idx + 1];
      const b = bgData.data[idx + 2];
      sum += (r + g + b) / 3;
      count++;
    }
    colBrightness.push(sum / count);
  }

  // Find the cutout by looking for a region of lower brightness
  // The cutout is usually a vertical strip of width ~slideW
  // Look for the region with the lowest average brightness, skipping the first 50px
  let minAvg = Infinity, minStart = 0;
  for (let x = 50; x < bgW - slideW; x++) {
    let avg = 0;
    for (let dx = 0; dx < slideW; dx++) {
      avg += colBrightness[x + dx];
    }
    avg /= slideW;
    if (avg < minAvg) {
      minAvg = avg;
      minStart = x;
    }
  }

  // Also detect edges: find columns with high variance (boundary of cutout)
  const colVariance = [];
  for (let x = 0; x < bgW; x++) {
    let mean = colBrightness[x];
    let vsum = 0;
    for (let y = 0; y < bgH; y++) {
      const idx = (y * bgW + x) * 4;
      const r = bgData.data[idx];
      const g = bgData.data[idx + 1];
      const b = bgData.data[idx + 2];
      vsum += Math.abs((r + g + b) / 3 - mean);
    }
    colVariance.push(vsum / bgH);
  }

  // Find the x position with highest edge response (left edge of cutout)
  let maxVar = 0, edgeX = 0;
  for (let x = 50; x < bgW - 10; x++) {
    if (colVariance[x] > maxVar) {
      maxVar = colVariance[x];
      edgeX = x;
    }
  }

  // The slider button is at x=382 in screen coords, puzzle piece at x=380
  // The slider track width is 340px, puzzle piece width is 68px
  // The background image displayed width is 340px
  // Scale factor from natural to displayed
  const scale = 340 / bgW;
  const targetScreenX = 380 + minStart * scale;
  const dragDistance = targetScreenX - 380;

  return JSON.stringify({
    bgSize: {w: bgW, h: bgH},
    slideSize: {w: slideW, h: slideCanvas.height},
    cutoutX: minStart,
    edgeX: edgeX,
    scale: scale,
    targetScreenX: targetScreenX,
    dragDistance: Math.round(dragDistance),
    colBrightnessPreview: colBrightness.filter((_, i) => i % 10 === 0).map(v => Math.round(v)).slice(0, 40)
  });
})()