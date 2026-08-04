(() => {
  const root = document.querySelector('#csr-root');
  if (!root) return JSON.stringify({error: 'no #csr-root'});
  const ck = Object.keys(root).find(k => k.startsWith('__reactContainer'));
  if (!ck) return JSON.stringify({error: 'no react container'});
  let fiber = root[ck];
  let visited = new Set();
  let found = [];

  function safeKeys(obj) {
    try { return Object.keys(obj); } catch(e) { return []; }
  }

  function deepFind(obj, path, depth) {
    if (!obj || typeof obj !== 'object' || depth > 2) return;
    var keys = safeKeys(obj);
    for (var i = 0; i < keys.length && i < 50; i++) {
      var k = keys[i];
      try {
        var v = obj[k];
        if (v && typeof v === 'object') {
          if (v.smsLoginManager) {
            found.push({path: path + '.' + k, keys: safeKeys(v).slice(0, 10)});
            return true;
          }
          if (depth < 2) {
            var subKeys = safeKeys(v);
            for (var j = 0; j < subKeys.length && j < 30; j++) {
              var sk = subKeys[j];
              try {
                var sv = v[sk];
                if (sv && typeof sv === 'object' && sv.smsLoginManager) {
                  found.push({path: path + '.' + k + '.' + sk, keys: safeKeys(sv).slice(0, 10)});
                  return true;
                }
              } catch(e) {}
            }
          }
        }
      } catch(e) {}
    }
    return false;
  }

  function walk(f, d) {
    if (!f || d > 60 || visited.has(f) || found.length >= 1) return;
    visited.add(f);
    try {
      var props = f.memoizedProps;
      if (props && typeof props === 'object') {
        if (props.accountService) {
          deepFind(props.accountService, 'props.accountService', 0);
        }
        if (props.value) {
          deepFind(props.value, 'props.value', 0);
        }
      }
    } catch(e) {}
    try {
      var h = f.memoizedState;
      var hi = 0;
      while (h && hi < 30) {
        try {
          var ms = h.memoizedState;
          if (ms && typeof ms === 'object') {
            deepFind(ms, 'hook' + hi, 0);
          }
        } catch(e) {}
        h = h.next;
        hi++;
      }
    } catch(e) {}
    try {
      var dep = f.dependencies;
      while (dep) {
        try {
          var dv = dep.memoizedState;
          if (dv && typeof dv === 'object') {
            deepFind(dv, 'dep', 0);
          }
        } catch(e) {}
        dep = dep.next;
      }
    } catch(e) {}
    if (f.child) walk(f.child, d + 1);
    if (f.sibling) walk(f.sibling, d + 1);
  }
  walk(fiber, 0);
  return JSON.stringify({found: found, visited: visited.size});
})()