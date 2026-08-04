(async () => {
  // 1. Block navigation
  const origOpen = window.open;
  window.open = function(url) { return window; };

  // 2. Get smsLoginManager
  let root = document.querySelector('#csr-root');
  if (!root) return JSON.stringify({error: 'no root'});
  const ck = Object.keys(root).find(k => k.startsWith('__reactContainer'));
  if (!ck) return JSON.stringify({error: 'no container'});
  let fiber = root[ck];
  let visited = new Set();
  let smsMgr = null;
  (function walk(f, d) {
    if (!f || d > 60 || visited.has(f) || smsMgr) return;
    visited.add(f);
    try {
      var h = f.memoizedState;
      var hi = 0;
      while (h && hi < 30 && !smsMgr) {
        try {
          var ms = h.memoizedState;
          if (ms && typeof ms === 'object' && ms !== null) {
            var keys = Object.keys(ms);
            for (var ki = 0; ki < keys.length; ki++) {
              try {
                var v0 = ms[keys[ki]];
                if (v0 && typeof v0 === 'object' && v0._userAccountService && v0._userAccountService.smsLoginManager) {
                  smsMgr = v0._userAccountService.smsLoginManager;
                  return;
                }
              } catch(e) {}
            }
          }
        } catch(e) {}
        h = h.next; hi++;
      }
    } catch(e) {}
    if (f.child) walk(f.child, d+1);
    if (f.sibling) walk(f.sibling, d+1);
  })(fiber, 0);

  if (!smsMgr) return JSON.stringify({error: 'no smsMgr', visited: visited.size});
  window.__smsLoginManager = smsMgr;

  // 3. Request SMS code
  smsMgr.setMobile('15011433480');
  smsMgr.setComplianceConfirmed(true);
  smsMgr.requestSmsCode();

  // 4. Wait for captcha image
  let bgEl = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 200));
    bgEl = document.getElementById('captcha_verify_image');
    if (bgEl && bgEl.src && bgEl.complete && bgEl.naturalWidth > 0) break;
    bgEl = null;
  }
  if (!bgEl) return JSON.stringify({error: 'no captcha img', data: {sending: smsMgr.data.smsCodeSending, sent: smsMgr.data.smsCodeSent}});

  // 5. Analyze images
  const slEl = document.getElementById('captcha-verify_img_slide');
  const btn = document.querySelector('.captcha-slider-btn');
  if (!slEl || !btn) return JSON.stringify({error: 'missing slide or btn'});

  const loadImg = (url) => new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('fail'));
    img.src = url;
  });

  let bg, slide;
  try { bg = await loadImg(bgEl.src); } catch(e) { return JSON.stringify({error: 'bg load fail', src: bgEl.src.slice(0, 80)}); }
  try { slide = await loadImg(slEl.src); } catch(e) { return JSON.stringify({error: 'slide load fail'}); }

  const bgW = bg.naturalWidth, bgH = bg.naturalHeight, slW = slide.naturalWidth;
  const canvas = document.createElement('canvas');
  canvas.width = bgW; canvas.height = bgH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bg, 0, 0);
  const px = ctx.getImageData(0, 0, bgW, bgH).data;

  // Edge detection: find column with highest left-right diff
  const colEdge = [];
  for (let x = 1; x < bgW; x++) {
    let s = 0;
    for (let y = 0; y < bgH; y++) {
      const i = (y * bgW + x) * 4;
      const il = (y * bgW + x - 1) * 4;
      s += Math.abs(px[i]-px[il]) + Math.abs(px[i+1]-px[il+1]) + Math.abs(px[i+2]-px[il+2]);
    }
    colEdge.push(s / bgH);
  }
  let maxE = 0, cutX = 0;
  for (let x = 40; x < bgW - 5; x++) {
    if (colEdge[x] > maxE) { maxE = colEdge[x]; cutX = x; }
  }

  // Also try brightness
  const colB = [];
  for (let x = 0; x < bgW; x++) {
    let s = 0;
    for (let y = 0; y < bgH; y++) {
      const i = (y * bgW + x) * 4;
      s += (px[i]+px[i+1]+px[i+2])/3;
    }
    colB.push(s/bgH);
  }
  let minB = Infinity, darkX = 0;
  for (let x = 40; x < bgW - slW; x++) {
    let a = 0;
    for (let d = 0; d < slW; d++) a += colB[x+d];
    a /= slW;
    if (a < minB) { minB = a; darkX = x; }
  }

  // Use edge detection result (more reliable)
  const scale = 340 / bgW;
  const dragPx = Math.round(cutX * scale);

  // 6. Simulate drag
  const r = btn.getBoundingClientRect();
  const sx = r.left + r.width/2;
  const sy = r.top + r.height/2;

  btn.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true, clientX:sx, clientY:sy, button:0}));
  const steps = 25;
  for (let i = 1; i <= steps; i++) {
    const p = i/steps;
    const e = 1 - Math.pow(1-p, 3);
    const x = sx + dragPx * e;
    const y = sy + (Math.random()-0.5)*2;
    document.dispatchEvent(new MouseEvent('mousemove', {bubbles:true, cancelable:true, clientX:x, clientY:y, button:0}));
    await new Promise(r => setTimeout(r, 20));
  }
  await new Promise(r => setTimeout(r, 50));
  document.dispatchEvent(new MouseEvent('mouseup', {bubbles:true, cancelable:true, clientX:sx+dragPx, clientY:sy, button:0}));

  await new Promise(r => setTimeout(r, 2500));

  return JSON.stringify({
    bgSize: {w: bgW, h: bgH},
    cutX, darkX, dragPx,
    sent: smsMgr.data.smsCodeSent,
    sending: smsMgr.data.smsCodeSending,
    err: smsMgr.data.hasSmsCodeError,
    errMsg: smsMgr.data.smsCodeErrorMessage,
    countdown: smsMgr.data.countdown,
    captchaVis: !!document.querySelector('#vc_captcha_wrapper')
  });
})()