(async () => {
  const bgEl = document.getElementById('captcha_verify_image');
  const slEl = document.getElementById('captcha-verify_img_slide');
  const btn = document.querySelector('.captcha-slider-btn');
  if (!bgEl || !slEl || !btn) return JSON.stringify({error: 'missing elements'});

  const loadImg = (url) => new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load fail'));
    img.src = url;
  });

  let bg, slide;
  try { bg = await loadImg(bgEl.src); } catch(e) { return JSON.stringify({error: 'bg load fail'}); }
  try { slide = await loadImg(slEl.src); } catch(e) { return JSON.stringify({error: 'slide load fail'}); }

  const bgW = bg.naturalWidth, bgH = bg.naturalHeight, slW = slide.naturalWidth;
  const canvas = document.createElement('canvas');
  canvas.width = bgW; canvas.height = bgH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bg, 0, 0);
  const data = ctx.getImageData(0, 0, bgW, bgH).data;

  // Find cutout: scan for the region with the highest edge contrast
  // The cutout has a visible shadow/edge on its left side
  const colEdges = [];
  for (let x = 1; x < bgW - 1; x++) {
    let edgeSum = 0;
    for (let y = 0; y < bgH; y++) {
      const idx = (y * bgW + x) * 4;
      const idxL = (y * bgW + (x - 1)) * 4;
      const diff = Math.abs(data[idx] - data[idxL]) + Math.abs(data[idx+1] - data[idxL+1]) + Math.abs(data[idx+2] - data[idxL+2]);
      edgeSum += diff;
    }
    colEdges.push(edgeSum / bgH);
  }

  // Find the x position with the highest edge (skip first 40px - the puzzle piece start area)
  let maxEdge = 0, cutoutX = 0;
  for (let x = 40; x < bgW - 5; x++) {
    if (colEdges[x] > maxEdge) { maxEdge = colEdges[x]; cutoutX = x; }
  }

  // Also check brightness-based detection
  const colBright = [];
  for (let x = 0; x < bgW; x++) {
    let s = 0;
    for (let y = 0; y < bgH; y++) {
      const idx = (y * bgW + x) * 4;
      s += (data[idx] + data[idx+1] + data[idx+2]) / 3;
    }
    colBright.push(s / bgH);
  }
  let minBright = Infinity, darkX = 0;
  for (let x = 40; x < bgW - slW; x++) {
    let avg = 0;
    for (let dx = 0; dx < slW; dx++) avg += colBright[x + dx];
    avg /= slW;
    if (avg < minBright) { minBright = avg; darkX = x; }
  }

  // Use the edge-based detection (more reliable for slider captchas)
  const bestX = cutoutX;

  // Calculate drag distance in screen coordinates
  const displayedBgW = 340;
  const scale = displayedBgW / bgW;
  const dragPx = Math.round(bestX * scale);

  // Get slider button position
  const btnRect = btn.getBoundingClientRect();
  const startX = btnRect.left + btnRect.width / 2;
  const startY = btnRect.top + btnRect.height / 2;

  // Simulate human-like drag
  btn.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true, clientX: startX, clientY: startY, button: 0}));

  // Move in steps with slight vertical variation and acceleration
  const steps = 30;
  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    // Ease-out: fast at start, slow at end
    const eased = 1 - Math.pow(1 - progress, 3);
    const x = startX + dragPx * eased;
    const y = startY + (Math.random() - 0.5) * 3;
    document.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0}));
    await new Promise(r => setTimeout(r, 25));
  }

  // Slight overshoot and correct (human-like)
  document.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, cancelable: true, clientX: startX + dragPx + 3, clientY: startY, button: 0}));
  await new Promise(r => setTimeout(r, 50));
  document.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, cancelable: true, clientX: startX + dragPx, clientY: startY, button: 0}));
  await new Promise(r => setTimeout(r, 100));

  // Mouse up
  document.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, cancelable: true, clientX: startX + dragPx, clientY: startY, button: 0}));

  // Wait for verification result
  await new Promise(r => setTimeout(r, 2000));

  const m = window.__smsLoginManager;
  return JSON.stringify({
    bgSize: {w: bgW, h: bgH},
    slideSize: {w: slW},
    cutoutX: bestX,
    darkX: darkX,
    dragPx: dragPx,
    scale: scale,
    smsCodeSent: m ? m.data.smsCodeSent : null,
    smsCodeSending: m ? m.data.smsCodeSending : null,
    hasError: m ? m.data.hasSmsCodeError : null,
    errorMsg: m ? m.data.smsCodeErrorMessage : null,
    countdown: m ? m.data.countdown : null,
    captchaVisible: !!document.querySelector('#vc_captcha_wrapper')
  });
})()