(() => {
  const root = document.querySelector('#csr-root');
  if (!root) return JSON.stringify({error: 'no #csr-root'});
  const ck = Object.keys(root).find(k => k.startsWith('__reactContainer'));
  if (!ck) return JSON.stringify({error: 'no react container'});
  let fiber = root[ck];
  let visited = new Set();
  let smsMgr = null;

  function safeKeys(obj) {
    try { return Object.keys(obj); } catch(e) { return []; }
  }

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
            var k0 = safeKeys(ms)[0];
            if (k0 !== undefined) {
              var v0 = ms[k0];
              if (v0 && typeof v0 === 'object' && v0._userAccountService) {
                smsMgr = v0._userAccountService.smsLoginManager;
                return;
              }
            }
          }
        } catch(e) {}
        h = h.next;
        hi++;
      }
    } catch(e) {}
    if (f.child) walk(f.child, d + 1);
    if (f.sibling) walk(f.sibling, d + 1);
  }
  walk(fiber, 0);
  if (!smsMgr) return JSON.stringify({error: 'smsLoginManager not found', visited: visited.size});

  window.__smsLoginManager = smsMgr;
  var keys = safeKeys(smsMgr);
  var dataKeys = smsMgr.data ? safeKeys(smsMgr.data) : [];
  return JSON.stringify({
    found: true,
    keys: keys,
    dataKeys: dataKeys,
    mobile: smsMgr.data ? smsMgr.data.mobile : null,
    isMobileValid: smsMgr.data ? smsMgr.data.isMobileValid : null
  });
})()