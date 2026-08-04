(async () => {
  // 1. Block all navigation
  window.__navLog = [];
  const origOpen = window.open;
  window.open = function(url) { window.__navLog.push('open:' + String(url).slice(0, 200)); return { postMessage: function(){}, close: function(){}, closed: false, location: {href: '', replace: function(){}, assign: function(){} }, document: {write: function(){}}, focus: function(){}, blur: function(){} }; };
  try {
    const origReplace = location.replace;
    location.replace = function(url) { window.__navLog.push('replace:' + String(url).slice(0, 200)); };
    const origAssign = location.assign;
    location.assign = function(url) { window.__navLog.push('assign:' + String(url).slice(0, 200)); };
  } catch(e) { window.__navLog.push('locOverrideFail:' + e.message); }

  // 2. Get smsLoginManager
  let root = null;
  for (let i = 0; i < 20; i++) {
    root = document.querySelector('#csr-root');
    if (root) break;
    await new Promise(r => setTimeout(r, 300));
  }
  if (!root) return JSON.stringify({error: 'no #csr-root', navLog: window.__navLog});
  const ck = Object.keys(root).find(k => k.startsWith('__reactContainer'));
  if (!ck) return JSON.stringify({error: 'no react container', navLog: window.__navLog});
  let fiber = root[ck];
  let visited = new Set();
  let smsMgr = null;
  function walk(f, d) {
    if (!f || d > 60 || visited.has(f) || smsMgr) return;
    visited.add(f);
    try {
      var h = f.memoizedState;
      var hi = 0;
      while (h && hi < 30 && !smsMgr) {
        try {
          var ms = h.memoizedState;
          if (ms && typeof ms === 'object') {
            var k0 = Object.keys(ms)[0];
            if (k0 !== undefined) {
              var v0 = ms[k0];
              if (v0 && typeof v0 === 'object' && v0._userAccountService) {
                smsMgr = v0._userAccountService.smsLoginManager;
                return;
              }
            }
          }
        } catch(e) {}
        h = h.next; hi++;
      }
    } catch(e) {}
    if (f.child) walk(f.child, d+1);
    if (f.sibling) walk(f.sibling, d+1);
  }
  walk(fiber, 0);
  if (!smsMgr) return JSON.stringify({error: 'no smsMgr', navLog: window.__navLog});
  window.__smsLoginManager = smsMgr;

  // 3. Set mobile and request code
  smsMgr.setMobile('15011433480');
  smsMgr.setComplianceConfirmed(true);
  smsMgr.requestSmsCode();

  // 4. Wait for captcha image to appear
  let bgImg = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    bgImg = document.getElementById('captcha_verify_image');
    if (bgImg && bgImg.src && bgImg.complete) break;
    bgImg = null;
  }
  if (!bgImg) return JSON.stringify({error: 'no captcha img', data: {sending: smsMgr.data.smsCodeSending, sent: smsMgr.data.smsCodeSent, err: smsMgr.data.hasSmsCodeError, errMsg: smsMgr.data.smsCodeErrorMessage}, navLog: window.__navLog});

  // 5. Analyze captcha
  const slideImg = document.getElementById('captcha-verify_img_slide');
  const loadImg = (url) => new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img); img.onerror = () => reject(new Error('fail'));
    img.src = url;
  });
  let bg, slide;
  try { bg = await loadImg(bgImg.src); } catch(e) { return JSON.stringify({error: 'bg load fail', src: bgImg.src.slice(0, 80)}); }
  try { slide = await loadImg(slideImg.src); } catch(e) { return JSON.stringify({error: 'slide load fail'}); }

  const bgW = bg.naturalWidth, bgH = bg.naturalHeight, slideW = slide.naturalWidth;
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = bgW; bgCanvas.height = bgH;
  const bgCtx = bgCanvas.getContext('2d');
  bgCtx.drawImage(bg, 0, 0);
  const bgData = bgCtx.getImageData(0, 0, bgW, bgH);

  // Find cutout: column with lowest brightness (skip first 40px)
  const colBright = [];
  for (let x = 0; x < bgW; x++) {
    let s = 0;
    for (let y = 0; y < bgH; y++) {
      const idx = (y * bgW + x) * 4;
      s += (bgData.data[idx] + bgData.data[idx+1] + bgData.data[idx+2]) / 3;
    }
    colBright.push(s / bgH);
  }
  let minAvg = Infinity, cutoutX = 0;
  for (let x = 40; x < bgW - slideW; x++) {
    let a = 0;
    for (let dx = 0; dx < slideW; dx++) a += colBright[x + dx];
    a /= slideW;
    if (a < minAvg) { minAvg = a; cutoutX = x; }
  }

  // 6. Calculate drag distance
  const displayedBgW = 340;
  const scale = displayedBgW / bgW;
  const dragPx = Math.round(cutoutX * scale);

  // 7. Simulate drag on slider button
  const sliderBtn = document.querySelector('.captcha-slider-btn');
  if (!sliderBtn) return JSON.stringify({error: 'no slider btn', cutoutX, dragPx});

  const btnRect = sliderBtn.getBoundingClientRect();
  const startX = btnRect.left + btnRect.width / 2;
  const startY = btnRect.top + btnRect.height / 2;

  // Mouse down
  sliderBtn.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true, clientX: startX, clientY: startY, button: 0}));
  // Mouse move in steps (human-like)
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    const x = startX + (dragPx * i / steps);
    document.dispatchEvent(new MouseEvent('mousemove', {bubbles: true, cancelable: true, clientX: x, clientY: startY, button: 0}));
    await new Promise(r => setTimeout(r, 30));
  }
  // Mouse up
  document.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, cancelable: true, clientX: startX + dragPx, clientY: startY, button: 0}));

  // Wait for result
  await new Promise(r => setTimeout(r, 2000));

  return JSON.stringify({
    bgSize: {w: bgW, h: bgH},
    cutoutX: cutoutX,
    dragPx: dragPx,
    scale: scale,
    smsCodeSent: smsMgr.data.smsCodeSent,
    smsCodeSending: smsMgr.data.smsCodeSending,
    hasError: smsMgr.data.hasSmsCodeError,
    errorMsg: smsMgr.data.smsCodeErrorMessage,
    countdown: smsMgr.data.countdown,
    navLog: window.__navLog
  });
})()