async page => {
  const ctx = page.context();
  await ctx.addInitScript(() => {
    try {
      function readTopCache() {
        try {
          const params = new URLSearchParams(location.search || '');
          const pageDateRange = params.get('dateRange') || '';
          const pageDateType = params.get('dateType') || '';
          const allKeys = Object.keys(localStorage).filter(k => k.includes('/cc/item/live/view/top.json'));
          const keys = allKeys.sort((a, b) => {
            const as = (pageDateRange && a.includes('dateRange=' + pageDateRange) ? 2 : 0) + (pageDateType && a.includes('dateType=' + pageDateType) ? 1 : 0);
            const bs = (pageDateRange && b.includes('dateRange=' + pageDateRange) ? 2 : 0) + (pageDateType && b.includes('dateType=' + pageDateType) ? 1 : 0);
            return bs - as;
          });
          for (const key of keys) {
            try {
              const raw = localStorage.getItem(key);
              let outer;
              try { outer = JSON.parse(raw); } catch (_) { outer = raw; }
              if (typeof outer !== 'string') continue;
              const pipe = outer.indexOf('|');
              if (pipe < 0) continue;
              const obj = JSON.parse(outer.slice(pipe + 1));
              const data = obj && obj.value && obj.value._d && obj.value._d.data;
              if (data && Array.isArray(data.data) && data.data.length) {
                return JSON.stringify(obj.value);
              }
            } catch (_) {}
          }
        } catch (_) {}
        return null;
      }

      try { localStorage.removeItem('debugConfig'); localStorage.removeItem('useDebug'); } catch (_) {}
      try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); } catch (_) {}
      try { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); } catch (_) {}

      const block = (e) => {
        const k = String(e.key || '').toLowerCase();
        if (k === 'f12' || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k)) || (e.ctrlKey && k === 'u')) {
          e.stopImmediatePropagation();
        }
      };
      try {
        addEventListener('keydown', block, true);
        addEventListener('keyup', block, true);
        addEventListener('keypress', block, true);
      } catch (_) {}

      try { Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth + 8, configurable: true }); } catch (_) {}
      try { Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 118, configurable: true }); } catch (_) {}
      try { Object.defineProperty(Document.prototype, 'hidden', { get: () => false, configurable: true }); } catch (_) {}
      try { Object.defineProperty(Document.prototype, 'visibilityState', { get: () => 'visible', configurable: true }); } catch (_) {}
      try { document.hasFocus = new Proxy(document.hasFocus, { apply: () => true }); } catch (_) {}

      if (!window.__sycmTopFallbackFetch) {
        window.__sycmTopFallbackFetch = true;
        const NativeResponse = window.Response;
        const nativeFetch = window.fetch;
        window.fetch = async function(input, init) {
          const url = typeof input === 'string' ? input : (input && input.url) || '';
          const resp = await nativeFetch.apply(this, arguments);
          if (url.includes('/cc/item/live/view/top.json')) {
            try {
              const clone = resp.clone();
              const text = await clone.text();
              if (text && text.includes('rgv587_flag') && text.includes('bixi.alicdn.com/punish')) {
                const cached = readTopCache();
                if (cached) return new NativeResponse(cached, { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json;charset=UTF-8' } });
              }
            } catch (_) {}
          }
          return resp;
        };
      }

      if (!window.__sycmTopFallbackXHR) {
        window.__sycmTopFallbackXHR = true;
        const XHR = window.XMLHttpRequest;
        const open = XHR.prototype.open;
        const send = XHR.prototype.send;
        XHR.prototype.open = function(method, url) {
          this.__sycm_url = String(url || '');
          return open.apply(this, arguments);
        };
        XHR.prototype.send = function() {
          if (this.__sycm_url && this.__sycm_url.includes('/cc/item/live/view/top.json')) {
            this.addEventListener('readystatechange', () => {
              try {
                if (this.readyState === 4 && this.responseText && this.responseText.includes('rgv587_flag') && this.responseText.includes('bixi.alicdn.com/punish')) {
                  const cached = readTopCache();
                  if (cached) {
                    Object.defineProperty(this, 'responseText', { get: () => cached, configurable: true });
                    Object.defineProperty(this, 'response', { get: () => cached, configurable: true });
                    Object.defineProperty(this, 'status', { get: () => 200, configurable: true });
                    Object.defineProperty(this, 'statusText', { get: () => 'OK', configurable: true });
                  }
                }
              } catch (_) {}
            });
          }
          return send.apply(this, arguments);
        };
      }
    } catch (_) {}
  });

  try {
    const client = await ctx.newCDPSession(page);
    await client.send('Debugger.setSkipAllPauses', { skip: true }).catch(() => {});
  } catch (_) {}

  return { installed: true, url: page.url(), note: 'reload page to activate init script' };
}
