async page => {
  const ctx = page.context();

  const ITEM_RANK_ENDPOINT = '/cc/item/live/view/top.json';
  const ITEM_RANK_DAILY_ENDPOINT = '/cc/item/view/top.json';
  const ITEM_RANK_ENDPOINTS = [ITEM_RANK_ENDPOINT, ITEM_RANK_DAILY_ENDPOINT];
  const MARKET_RANK_ENDPOINT = '/mc/mq/mkt/item/offline/rank.json';
  const MARKET_RANK_ALTERNATES = [
    '/mc/mq/mkt/item/offline/rank/search.json',
    '/mc/mq/mkt/item/offline/rank/purpose.json'
  ];
  const ROUTE_FALLBACK_FLAG = '__sycm_enable_route_fallback';
  const RECOVERED_VIEW_FLAG = '__sycm_enable_recovered_view';
  const allowRouteFallback = await page.evaluate(flag => {
    const read = store => { try { return !!store && store.getItem(flag) === '1'; } catch (_) { return false; } };
    return read(sessionStorage) || read(localStorage);
  }, ROUTE_FALLBACK_FLAG).catch(() => false);

  function parseJson(text) {
    try { return JSON.parse(text); } catch (_) { return null; }
  }

  function getRankRowsFromPayload(payload) {
    if (!payload || typeof payload !== 'object') return [];
    const candidates = [
      payload && payload._d && payload._d.data && payload._d.data.data,
      payload && payload._d && payload._d.data,
      payload && payload.data && payload.data.data,
      payload && payload.data,
      payload && payload.list,
      payload && payload.result
    ];
    for (const value of candidates) {
      if (Array.isArray(value)) return value;
    }
    return [];
  }

  function hasRankRows(text) {
    const json = typeof text === 'string' ? parseJson(text) : text;
    return getRankRowsFromPayload(json).length > 0;
  }

  function isPunishBody(text) {
    const s = String(text || '');
    return (s.includes('rgv587_flag') && s.includes('punish')) ||
      s.includes('bixi.alicdn.com/punish') ||
      s.includes('punish:resource:template') ||
      s.includes('bxpunish') ||
      s.includes('punishURL') ||
      s.includes('baxia') ||
      s.includes('压力山大') ||
      s.includes('稍后再试');
  }

  async function responseHeaders(resp) {
    try {
      const headers = await resp.headers();
      return headers || {};
    } catch (_) {
      try { return resp.headers() || {}; } catch (__) { return {}; }
    }
  }

  function isPunishHeaders(headers) {
    const h = headers || {};
    const joined = Object.keys(h).map(k => k + ':' + h[k]).join('\n').toLowerCase();
    return joined.includes('bxpunish') || joined.includes('bixi.alicdn.com/punish') || joined.includes('punish');
  }

  function isPunishResponse(headers, text) {
    return isPunishHeaders(headers) || isPunishBody(text);
  }

  function itemRankEndpointFor(url) {
    const source = String(url || '');
    return ITEM_RANK_ENDPOINTS.find(endpoint => source.includes(endpoint)) || ITEM_RANK_ENDPOINT;
  }


  function marketRankAlternateUrls(url) {
    const source = String(url || '');
    if (!source.includes(MARKET_RANK_ENDPOINT)) return [];
    const preferred = source.includes('rankType=add') ?
      '/mc/mq/mkt/item/offline/rank/purpose.json' :
      '/mc/mq/mkt/item/offline/rank/search.json';
    const ordered = [preferred, ...MARKET_RANK_ALTERNATES.filter(path => path !== preferred)];
    return ordered.map(path => source.replace(MARKET_RANK_ENDPOINT, path));
  }

  async function readPageCache(endpoint, requestUrl) {
    try {
      return await page.evaluate(({ endpoint, requestUrl }) => {
        function normalizeUrl(input) {
          try { return new URL(input, location.href); } catch (_) { return null; }
        }
        function parseCacheValue(raw) {
          if (!raw) return null;
          let outer;
          try { outer = JSON.parse(raw); } catch (_) { outer = raw; }
          if (typeof outer === 'string') {
            const pipe = outer.indexOf('|');
            if (pipe >= 0) {
              try {
                const obj = JSON.parse(outer.slice(pipe + 1));
                return obj && Object.prototype.hasOwnProperty.call(obj, 'value') ? obj.value : obj;
              } catch (_) { return null; }
            }
            try { return JSON.parse(outer); } catch (_) { return null; }
          }
          if (outer && Object.prototype.hasOwnProperty.call(outer, 'value')) return outer.value;
          return outer;
        }
        function rows(payload) {
          if (!payload || typeof payload !== 'object') return [];
          const candidates = [payload._d && payload._d.data && payload._d.data.data, payload._d && payload._d.data, payload.data && payload.data.data, payload.data, payload.list, payload.result];
          for (const value of candidates) if (Array.isArray(value)) return value;
          return [];
        }
        function score(key) {
          const u = normalizeUrl(requestUrl);
          let out = key.includes('__sycm_interceptor_cache|') ? 100 : 0;
          if (u) {
            for (const [name, value] of u.searchParams.entries()) {
              if (value && key.includes(name + '=' + value)) out += 1;
            }
          }
          const pageParams = new URLSearchParams(location.search || '');
          for (const name of ['dateRange', 'dateType', 'cateId', 'parentCateId', 'cateFlag', 'activeKey']) {
            const value = pageParams.get(name);
            if (value && key.includes(name + '=' + value)) out += 2;
          }
          return out;
        }
        const keys = Object.keys(localStorage).filter(k => k.includes(endpoint)).sort((a, b) => score(b) - score(a));
        for (const key of keys) {
          try {
            const value = parseCacheValue(localStorage.getItem(key));
            if (rows(value).length > 0) return JSON.stringify(value);
          } catch (_) {}
        }
        return null;
      }, { endpoint, requestUrl });
    } catch (_) {
      return null;
    }
  }

  async function rememberPageCache(endpoint, requestUrl, text, source) {
    if (!hasRankRows(text)) return;
    try {
      await page.evaluate(({ endpoint, requestUrl, text, source }) => {
        function pack(value) {
          const body = JSON.stringify({ value, source, savedAt: Date.now() });
          return JSON.stringify(String(body.length) + '|' + body);
        }
        try {
          const value = JSON.parse(text);
          const key = '__sycm_interceptor_cache|' + endpoint + '|' + new URL(requestUrl, location.href).pathname + '?' + new URL(requestUrl, location.href).searchParams.toString();
          localStorage.setItem(key, pack(value));
          sessionStorage.setItem('__sycm_last_rank_payload|' + endpoint, text);
          sessionStorage.setItem('__sycm_last_rank_url|' + endpoint, requestUrl);
          sessionStorage.setItem('__sycm_last_rank_payload', text);
          sessionStorage.setItem('__sycm_last_rank_url', requestUrl);
        } catch (_) {}
      }, { endpoint, requestUrl, text, source });
    } catch (_) {}
  }


  function makeOuterEmptyResponse(endpoint, requestUrl) {
    const now = Date.now();
    const base = {
      code: 0,
      message: 'ok-empty-risk-fallback',
      data: { recordCount: 0, total: 0, data: [], list: [], result: [] },
      _e: now,
      _id: 'sycm-rank-empty-fallback'
    };
    if (ITEM_RANK_ENDPOINTS.includes(endpoint)) {
      base._d = {
        code: 0,
        message: 'ok-empty-risk-fallback',
        data: { recordCount: 0, total: 0, data: [] },
        updateTime: new Date(now).toISOString().replace('T', ' ').slice(0, 19)
      };
      return JSON.stringify(base);
    }
    base._d = {
      code: 0,
      message: 'ok-empty-risk-fallback',
      data: { recordCount: 0, total: 0, data: [], list: [], result: [] },
      updateTime: new Date(now).toISOString().replace('T', ' ').slice(0, 19)
    };
    return JSON.stringify(base);
  }

  async function installItemRankRoute() {
    const patterns = ['**/cc/item/live/view/top.json**', '**/cc/item/view/top.json**'];
    const handler = async route => {
      const request = route.request();
      const originalUrl = request.url();
      const endpoint = itemRankEndpointFor(originalUrl);
      const fulfillJson = async (body, source) => route.fulfill({
        status: 200,
        contentType: 'application/json;charset=UTF-8',
        headers: {
          'cache-control': 'no-store',
          'content-type': 'application/json;charset=UTF-8',
          'x-sycm-fallback-source': source
        },
        body
      });
      try {
        const originalResp = await route.fetch();
        const originalHeaders = await responseHeaders(originalResp);
        const originalText = await originalResp.text();
        if (!isPunishResponse(originalHeaders, originalText) && hasRankRows(originalText)) {
          await rememberPageCache(endpoint, originalUrl, originalText, 'item-route-original');
          await route.fulfill({
            status: originalResp.status(),
            headers: originalHeaders,
            body: originalText
          });
          return;
        }

        const headers = { ...request.headers() };
        delete headers.host;
        headers.referer = headers.referer || page.url();
        headers['sycm-referer'] = headers['sycm-referer'] || '/cc/item_rank';
        headers['onetrace-card-id'] = headers['onetrace-card-id'] || 'sycm-cc-item-rank.%2Fcc%2Fitem_rank';
        try {
          const apiResp = await ctx.request.get(originalUrl, { headers });
          const apiHeaders = await responseHeaders(apiResp);
          const apiText = await apiResp.text();
          if (!isPunishResponse(apiHeaders, apiText) && hasRankRows(apiText)) {
            await rememberPageCache(endpoint, originalUrl, apiText, 'item-route-api-request');
            await fulfillJson(apiText, 'api-request');
            return;
          }
        } catch (_) {}

        const cached = await readPageCache(endpoint, originalUrl);
        if (cached && hasRankRows(cached)) {
          await fulfillJson(cached, 'localStorage');
          return;
        }

        await fulfillJson(makeOuterEmptyResponse(endpoint, originalUrl), 'empty-risk-fallback');
      } catch (e) {
        const endpoint = itemRankEndpointFor(route.request().url());
        const cached = await readPageCache(endpoint, route.request().url());
        if (cached && hasRankRows(cached)) {
          await fulfillJson(cached, 'localStorage-after-error').catch(() => {});
          return;
        }
        await fulfillJson(makeOuterEmptyResponse(endpoint, route.request().url()), 'empty-error-fallback').catch(() => {});
      }
    };
    for (const pattern of patterns) {
      await page.unroute(pattern).catch(() => {});
      await page.route(pattern, handler);
    }
  }

  async function clearRankRoutes() {
    const patterns = [
      '**/cc/item/live/view/top.json**',
      '**/cc/item/view/top.json**',
      '**/mc/mq/mkt/item/offline/rank.json**'
    ];
    for (const pattern of patterns) {
      await page.unroute(pattern).catch(() => {});
    }
  }

  async function installMarketRankRoute() {
    const pattern = '**/mc/mq/mkt/item/offline/rank.json**';
    await page.unroute(pattern).catch(() => {});
    await page.route(pattern, async route => {
      const request = route.request();
      const originalUrl = request.url();
      try {
        const originalResp = await route.fetch();
        const originalHeaders = await responseHeaders(originalResp);
        const originalText = await originalResp.text();
        if (!isPunishResponse(originalHeaders, originalText) && hasRankRows(originalText)) {
          await rememberPageCache(MARKET_RANK_ENDPOINT, originalUrl, originalText, 'route-original');
          await route.fulfill({
            status: originalResp.status(),
            headers: originalHeaders,
            body: originalText
          });
          return;
        }

        const headers = { ...request.headers() };
        delete headers.host;
        headers.referer = headers.referer || page.url();
        headers['sycm-referer'] = headers['sycm-referer'] || '/mc/free/market_rank';
        headers['onetrace-card-id'] = headers['onetrace-card-id'] || '%2Fmc%2Ffree%2Fmarket_rank%7C%E5%B8%82%E5%9C%BA%E6%8E%92%E8%A1%8C-%E5%95%86%E5%93%81-%E5%95%86%E5%93%81%E6%8E%92%E8%A1%8C';

        for (const altUrl of marketRankAlternateUrls(originalUrl)) {
          try {
            const altResp = await ctx.request.get(altUrl, { headers });
            const altHeaders = await responseHeaders(altResp);
            const altText = await altResp.text();
            if (!isPunishResponse(altHeaders, altText) && hasRankRows(altText)) {
              await rememberPageCache(MARKET_RANK_ENDPOINT, originalUrl, altText, 'route-alternate:' + altUrl);
              await route.fulfill({
                status: 200,
                contentType: 'application/json;charset=UTF-8',
                headers: {
                  'cache-control': 'no-store',
                  'content-type': 'application/json;charset=UTF-8',
                  'x-sycm-fallback-source': altUrl
                },
                body: altText
              });
              return;
            }
          } catch (_) {}
        }

        const cached = await readPageCache(MARKET_RANK_ENDPOINT, originalUrl);
        if (cached && hasRankRows(cached)) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json;charset=UTF-8',
            headers: { 'cache-control': 'no-store', 'content-type': 'application/json;charset=UTF-8', 'x-sycm-fallback-source': 'localStorage' },
            body: cached
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json;charset=UTF-8',
          body: JSON.stringify({ code: 0, message: 'fallback-empty-no-cache', data: { recordCount: 0, data: [] } })
        });
      } catch (e) {
        const cached = await readPageCache(MARKET_RANK_ENDPOINT, originalUrl);
        if (cached && hasRankRows(cached)) {
          await route.fulfill({ status: 200, contentType: 'application/json;charset=UTF-8', body: cached }).catch(() => {});
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json;charset=UTF-8',
          body: JSON.stringify({ code: 0, message: 'fallback-error:' + (e && e.message || e), data: { recordCount: 0, data: [] } })
        }).catch(() => {});
      }
    });
  }

  await clearRankRoutes();
  if (allowRouteFallback) {
    await installMarketRankRoute();
    await installItemRankRoute();
  }

  const installSycmPatch = () => {
    try {
      const ITEM_RANK_ENDPOINT = '/cc/item/live/view/top.json';
      const ITEM_RANK_DAILY_ENDPOINT = '/cc/item/view/top.json';
      const ITEM_RANK_ENDPOINTS = [ITEM_RANK_ENDPOINT, ITEM_RANK_DAILY_ENDPOINT];
      const ENDPOINTS = [
        ...ITEM_RANK_ENDPOINTS,
        '/mc/mq/mkt/item/offline/rank.json',
        '/mc/mq/mkt/item/offline/rank/search.json',
        '/mc/mq/mkt/item/offline/rank/purpose.json'
      ];
      const MARKET_RANK_ENDPOINT = '/mc/mq/mkt/item/offline/rank.json';

      function normalizeUrl(input) {
        try {
          const raw = typeof input === 'string' ? input : (input && input.url) || '';
          return new URL(raw, location.href);
        } catch (_) {
          return null;
        }
      }

      function endpointFor(input) {
        const u = normalizeUrl(input);
        if (!u) return '';
        if (u.pathname.includes('/mc/mq/mkt/item/offline/rank/')) return MARKET_RANK_ENDPOINT;
        return ENDPOINTS.find(path => u.pathname.includes(path)) || '';
      }

      function isPunishUrl(value) {
        const s = String(value || '');
        return s.includes('bixi.alicdn.com/punish') ||
          s.includes('punish:resource:template') ||
          s.includes('/punish/') ||
          s.includes('bxpunish');
      }

      function isPunishText(text) {
        const s = String(text || '');
        return (s.includes('rgv587_flag') && s.includes('punish')) ||
          s.includes('bixi.alicdn.com/punish') ||
          s.includes('punish:resource:template') ||
          s.includes('bxpunish') ||
          s.includes('punishURL') ||
          s.includes('baxia') ||
          s.includes('压力山大') ||
          s.includes('稍后再试');
      }

      function parseCacheValue(raw) {
        if (!raw) return null;
        let outer;
        try { outer = JSON.parse(raw); } catch (_) { outer = raw; }
        if (typeof outer === 'string') {
          const pipe = outer.indexOf('|');
          if (pipe >= 0) {
            const obj = JSON.parse(outer.slice(pipe + 1));
            return obj && Object.prototype.hasOwnProperty.call(obj, 'value') ? obj.value : obj;
          }
          try { return JSON.parse(outer); } catch (_) { return null; }
        }
        if (outer && Object.prototype.hasOwnProperty.call(outer, 'value')) return outer.value;
        return outer;
      }

      function getRankRowsFromPayload(payload) {
        if (!payload || typeof payload !== 'object') return [];
        const candidates = [
          payload && payload._d && payload._d.data && payload._d.data.data,
          payload && payload._d && payload._d.data,
          payload && payload.data && payload.data.data,
          payload && payload.data,
          payload && payload.list,
          payload && payload.result
        ];
        for (const value of candidates) if (Array.isArray(value)) return value;
        return [];
      }

      function hasUsablePayload(value) {
        return getRankRowsFromPayload(value).length > 0;
      }

      function hasUsablePayloadText(text) {
        try { return hasUsablePayload(JSON.parse(text)); } catch (_) { return false; }
      }

      function cacheScore(key, requestUrl) {
        const u = normalizeUrl(requestUrl);
        let score = key.includes('__sycm_interceptor_cache|') ? 100 : 0;
        if (!u) return score;
        for (const [name, value] of u.searchParams.entries()) {
          if (value && key.includes(name + '=' + value)) score += 1;
        }
        const pageParams = new URLSearchParams(location.search || '');
        for (const name of ['dateRange', 'dateType', 'cateId', 'parentCateId', 'cateFlag', 'activeKey']) {
          const value = pageParams.get(name);
          if (value && key.includes(name + '=' + value)) score += 2;
        }
        return score;
      }

      function cacheKey(endpoint, requestUrl) {
        const u = normalizeUrl(requestUrl);
        return '__sycm_interceptor_cache|' + endpoint + '|' + (u ? (u.pathname + '?' + u.searchParams.toString()) : String(requestUrl || ''));
      }

      function cacheParamMatches(key, name, value) {
        if (value == null || value === '') return true;
        const raw = name + '=' + String(value);
        const enc = name + '=' + encodeURIComponent(String(value));
        return key.includes(raw) || key.includes(enc);
      }

      function cacheMatchesRequest(key, requestUrl) {
        try {
          const request = normalizeUrl(requestUrl);
          const pageParams = new URLSearchParams(location.search || '');
          for (const name of ['dateRange', 'dateType']) {
            const value = (request && request.searchParams.get(name)) || pageParams.get(name) || '';
            if (value && !cacheParamMatches(key, name, value)) return false;
          }
          for (const name of ['page', 'pageSize', 'order', 'orderBy', 'keyword', 'follow', 'cateId', 'cateLevel', 'indexCode']) {
            const value = request && request.searchParams.get(name);
            if (value && !cacheParamMatches(key, name, value)) return false;
          }
          return true;
        } catch (_) {
          return false;
        }
      }

      function sycmFlagEnabled(name) {
        try { if (sessionStorage.getItem(name) === '1') return true; } catch (_) {}
        try { if (localStorage.getItem(name) === '1') return true; } catch (_) {}
        return false;
      }

      function routeFallbackEnabled() {
        return sycmFlagEnabled('__sycm_enable_route_fallback');
      }

      function recoveredViewEnabled() {
        return sycmFlagEnabled('__sycm_enable_recovered_view') ||
          sycmFlagEnabled('__sycm_auto_recover_item_rank') ||
          routeFallbackEnabled();
      }

      function isRecoveredItemRankNode(node) {
        try {
          return !!node && node.nodeType === 1 && (
            node.id === '__sycm_item_rank_recovered' ||
            (node.getAttribute && node.getAttribute('data-sycm-f12-fallback') === 'item-rank')
          );
        } catch (_) {
          return false;
        }
      }

      function cleanupRecoveredItemRank() {
        try {
          if (recoveredViewEnabled() || !document.querySelectorAll) return;
          document.querySelectorAll('#__sycm_item_rank_recovered,[data-sycm-f12-fallback="item-rank"]').forEach(el => {
            try { el.remove(); } catch (_) { try { el.style.display = 'none'; } catch (__) {} }
          });
        } catch (_) {}
      }

      function installRecoveredViewGuard() {
        if (window.__sycmRecoveredViewGuardVersion >= 1) return;
        window.__sycmRecoveredViewGuardVersion = 1;

        const blockRecoveredNode = node => {
          if (isRecoveredItemRankNode(node) && !recoveredViewEnabled()) {
            setTimeout(cleanupRecoveredItemRank, 0);
            return true;
          }
          return false;
        };

        const nativeAppendChild = Node.prototype.appendChild;
        Node.prototype.appendChild = function(node) {
          if (blockRecoveredNode(node)) return node;
          return nativeAppendChild.apply(this, arguments);
        };

        const nativeInsertBefore = Node.prototype.insertBefore;
        Node.prototype.insertBefore = function(node) {
          if (blockRecoveredNode(node)) return node;
          return nativeInsertBefore.apply(this, arguments);
        };

        const startObserver = () => {
          cleanupRecoveredItemRank();
          try {
            const root = document.documentElement || document;
            const mo = new MutationObserver(() => cleanupRecoveredItemRank());
            mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['id', 'data-sycm-f12-fallback'] });
          } catch (_) {}
          try { setInterval(cleanupRecoveredItemRank, 250); } catch (_) {}
        };
        if (document.documentElement) startObserver();
        else addEventListener('DOMContentLoaded', startObserver, { once: true });
      }

      function packCache(value, source) {
        const body = JSON.stringify({ value, source, savedAt: Date.now() });
        return JSON.stringify(String(body.length) + '|' + body);
      }

      function rememberCache(endpoint, requestUrl, text, source) {
        try {
          const value = JSON.parse(text);
          if (!hasUsablePayload(value)) return;
          localStorage.setItem(cacheKey(endpoint, requestUrl), packCache(value, source || 'page'));
          sessionStorage.setItem('__sycm_last_rank_payload|' + endpoint, text);
          sessionStorage.setItem('__sycm_last_rank_url|' + endpoint, String(requestUrl || ''));
          sessionStorage.setItem('__sycm_last_rank_payload', text);
          sessionStorage.setItem('__sycm_last_rank_url', String(requestUrl || ''));
          if (ITEM_RANK_ENDPOINTS.includes(endpoint)) setTimeout(renderRecoveredItemRank, 0);
        } catch (_) {}
      }

      function readCacheForEndpoint(endpoint, requestUrl) {
        try {
          const keys = Object.keys(localStorage)
            .filter(k => k.includes(endpoint) && cacheMatchesRequest(k, requestUrl))
            .sort((a, b) => cacheScore(b, requestUrl) - cacheScore(a, requestUrl));
          for (const key of keys) {
            try {
              const value = parseCacheValue(localStorage.getItem(key));
              if (hasUsablePayload(value)) return JSON.stringify(value);
            } catch (_) {}
          }
        } catch (_) {}
        try {
          const scopedLast = sessionStorage.getItem('__sycm_last_rank_payload|' + endpoint);
          if (scopedLast && hasUsablePayloadText(scopedLast)) return scopedLast;
          const lastUrl = sessionStorage.getItem('__sycm_last_rank_url') || '';
          const last = sessionStorage.getItem('__sycm_last_rank_payload');
          if (lastUrl.includes(endpoint) && last && hasUsablePayloadText(last)) return last;
        } catch (_) {}
        return null;
      }


      function scalarValue(value) {
        if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) return value.value;
        return value == null ? '' : value;
      }

      function formatMetric(value) {
        const raw = scalarValue(value);
        if (raw === '' || raw == null) return '';
        if (typeof raw === 'number') {
          try { return raw.toLocaleString('zh-CN', { maximumFractionDigits: 2 }); } catch (_) { return String(raw); }
        }
        return String(raw);
      }

      function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
      }

      function renderRecoveredItemRank() {
        try {
          if (!location.pathname.includes('/cc/item_rank')) return;
          if (!document.body) return;
          const existing = document.getElementById('__sycm_item_rank_recovered');
          if (!recoveredViewEnabled()) {
            cleanupRecoveredItemRank();
            return;
          }
          const pageText = document.body.innerText || '';
          const recoveredText = existing ? (existing.innerText || existing.textContent || '') : '';
          const nativeText = recoveredText ? pageText.replace(recoveredText, '') : pageText;
          const nativeHasRows = /ID:\d+/.test(nativeText) && /\d{1,3}(,\d{3})*\.\d{2}/.test(nativeText);
          const pressureVisible = isPressureText(nativeText);
          if (nativeHasRows && !pressureVisible) {
            if (existing) existing.remove();
            return;
          }
          const cachedText = ITEM_RANK_ENDPOINTS.map(endpoint => readCacheForEndpoint(endpoint, location.href)).find(Boolean);
          if (!cachedText) return;
          const payload = JSON.parse(cachedText);
          const rows = getRankRowsFromPayload(payload).slice(0, 20);
          if (!rows.length) return;
          const signature = rows.map((row, index) => {
            const item = row.item || {};
            return [index, scalarValue(item.itemId) || scalarValue(row.itemId) || '', scalarValue(row.payAmt), scalarValue(row.itmUv || row.uv)].join(':');
          }).join('|');
          const host = document.querySelector('.sycm-cc-item-rank-table') || document.querySelector('#item-rank .oui-card-content') || document.querySelector('#item-rank') || document.body;
          const parent = host.parentElement || document.body;
          const box = existing || document.createElement('div');
          if (existing && existing.getAttribute('data-signature') === signature) return;
          box.id = '__sycm_item_rank_recovered';
          box.setAttribute('data-signature', signature);
          box.setAttribute('data-sycm-f12-fallback', 'item-rank');
          box.style.cssText = 'margin:12px 0;padding:12px;border:1px solid #d7e3ff;border-radius:8px;background:#f7faff;color:#1f2937;font-size:12px;line-height:1.5;overflow:auto;';
          const header = '<div style="font-weight:600;margin-bottom:8px;color:#1d4ed8">F12-safe ??????????????</div>';
          const tableHead = '<thead><tr>' + ['??','??','??ID','????','????','?????','???','????'].map(h => '<th style="text-align:left;padding:6px 8px;border-bottom:1px solid #dbeafe;white-space:nowrap">' + h + '</th>').join('') + '</tr></thead>';
          const tableRows = rows.map((row, index) => {
            const item = row.item || {};
            const itemId = scalarValue(item.itemId) || scalarValue(row.itemId) || '';
            const title = item.title || scalarValue(row.title) || '';
            const rank = scalarValue(row.rank) || scalarValue(row.cateRankId) || (index + 1);
            const payAmt = formatMetric(row.payAmt);
            const payItmCnt = formatMetric(row.payItmCnt);
            const payRateRaw = scalarValue(row.payRate);
            const payRate = typeof payRateRaw === 'number' ? (payRateRaw * 100).toFixed(2) + '%' : formatMetric(payRateRaw);
            const uv = formatMetric(row.itmUv || row.uv);
            const cart = formatMetric(row.itemCartCnt || row.cartByrCnt);
            return '<tr>' +
              '<td style="padding:6px 8px;border-bottom:1px solid #edf2ff">' + escapeHtml(rank) + '</td>' +
              '<td style="padding:6px 8px;border-bottom:1px solid #edf2ff;min-width:220px">' + escapeHtml(title) + '</td>' +
              '<td style="padding:6px 8px;border-bottom:1px solid #edf2ff;white-space:nowrap">ID:' + escapeHtml(itemId) + '</td>' +
              '<td style="padding:6px 8px;border-bottom:1px solid #edf2ff;white-space:nowrap">' + escapeHtml(payAmt) + '</td>' +
              '<td style="padding:6px 8px;border-bottom:1px solid #edf2ff;white-space:nowrap">' + escapeHtml(payItmCnt) + '</td>' +
              '<td style="padding:6px 8px;border-bottom:1px solid #edf2ff;white-space:nowrap">' + escapeHtml(payRate) + '</td>' +
              '<td style="padding:6px 8px;border-bottom:1px solid #edf2ff;white-space:nowrap">' + escapeHtml(uv) + '</td>' +
              '<td style="padding:6px 8px;border-bottom:1px solid #edf2ff;white-space:nowrap">' + escapeHtml(cart) + '</td>' +
              '</tr>';
          }).join('');
          box.innerHTML = header + '<table style="border-collapse:collapse;width:100%;background:white">' + tableHead + '<tbody>' + tableRows + '</tbody></table>';
          if (!existing) parent.insertBefore(box, host.nextSibling);
        } catch (_) {}
      }

      function makeEmptyResponse(requestUrl) {
        const u = normalizeUrl(requestUrl);
        const endpoint = endpointFor(requestUrl);
        const now = Date.now();
        const dateRange = (u && u.searchParams.get('dateRange')) || new URLSearchParams(location.search || '').get('dateRange') || '';
        const dateType = (u && u.searchParams.get('dateType')) || new URLSearchParams(location.search || '').get('dateType') || '';
        const itemShape = ITEM_RANK_ENDPOINTS.includes(endpoint);
        return JSON.stringify({
          code: 0,
          message: 'ok-empty-risk-fallback',
          data: { recordCount: 0, total: 0, data: [], list: [], result: [] },
          _d: {
            code: 0,
            message: 'ok-empty-risk-fallback',
            data: itemShape ? { recordCount: 0, total: 0, data: [] } : { recordCount: 0, total: 0, data: [], list: [], result: [] },
            dateRange,
            dateType,
            updateTime: new Date(now).toISOString().replace('T', ' ').slice(0, 19)
          },
          _e: now,
          _id: 'sycm-rank-empty-fallback'
        });
      }

      function fallbackFor(requestUrl) {
        const endpoint = endpointFor(requestUrl);
        if (!endpoint) return null;
        const cached = readCacheForEndpoint(endpoint, requestUrl);
        if (cached) return cached;
        if (endpoint === MARKET_RANK_ENDPOINT || ITEM_RANK_ENDPOINTS.includes(endpoint)) return makeEmptyResponse(requestUrl);
        return null;
      }

      function isPressureText(text) {
        const s = String(text || '');
        return ['压力山大', '稍后再试', '安全提示', '异常访问行为', '高频/脚本访问', '脚本访问', '安装插件', '账号共享', '限制访问', '请规范使用'].some(word => s.includes(word));
      }

      function isBaxiaNode(node) {
        try {
          if (!node || node.nodeType !== 1) return false;
          const el = node;
          const cls = String(el.className || '');
          const id = String(el.id || '');
          const src = String(el.src || el.getAttribute && el.getAttribute('src') || '');
          const html = String(el.outerHTML || '');
          return cls.includes('baxia') || id.includes('baxia') || cls.includes('punish') || id.includes('punish') || isPunishUrl(src) || isPunishUrl(html);
        } catch (_) {
          return false;
        }
      }

      function cleanupPressureText() {
        try {
          if (!document.body) return;
          const nodes = Array.from(document.body.querySelectorAll('div,span,p,td,tr,section,article'));
          for (const el of nodes) {
            const text = el.innerText || el.textContent || '';
            if (!isPressureText(text)) continue;
            const hasPressureChild = Array.from(el.children || []).some(child => isPressureText(child.innerText || child.textContent || ''));
            if (!hasPressureChild) {
              const container = el.closest('[role="dialog"],[class*=dialog],[class*=Dialog],[class*=modal],[class*=Modal],[class*=popup],[class*=Popup],[class*=overlay],[class*=Overlay],[class*=mask],[class*=Mask]') || el;
              try { container.remove(); } catch (_) { try { container.style.display = 'none'; } catch (_) {} }
            }
          }
        } catch (_) {}
      }

      function installPressureDomGuard() {
        if (window.__sycmPressureDomGuardVersion >= 3) return;
        window.__sycmPressureDomGuardVersion = 3;
        window.__sycmPressureDomGuard = true;
        const refreshRecoveredView = () => {
          cleanupPressureText();
          renderRecoveredItemRank();
        };
        const startObserver = () => {
          refreshRecoveredView();
          try {
            const root = document.documentElement || document;
            const mo = new MutationObserver(() => refreshRecoveredView());
            mo.observe(root, { childList: true, subtree: true, characterData: true });
          } catch (_) {}
          try { setInterval(refreshRecoveredView, 1000); } catch (_) {}
        };
        if (document.documentElement) startObserver();
        else addEventListener('DOMContentLoaded', startObserver, { once: true });
      }

      function installBaxiaStyleGuard() {
        try {
          if (document.getElementById('__sycm_baxia_style_guard')) return;
          const style = document.createElement('style');
          style.id = '__sycm_baxia_style_guard';
          style.textContent = [
            '.baxia-dialog', '.baxia-dialog-mask', '.baxia-dialog-content', '.baxia-dialog-close',
            '[class*=baxia]', '[id*=baxia]', '[class*=punish]', '[id*=punish]',
            'iframe[src*=bixi.alicdn.com/punish]', 'iframe[src*=punish:resource:template]', 'iframe[src*=/punish/]'
          ].join(',') + '{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}';
          (document.head || document.documentElement).appendChild(style);
        } catch (_) {}
      }

      function cleanupBaxia() {
        try {
          installBaxiaStyleGuard();
          const selectors = [
            '.baxia-dialog', '.baxia-dialog-mask', '.baxia-dialog-content', '.baxia-dialog-close',
            '[class*=baxia]', '[id*=baxia]', '[class*=punish]', '[id*=punish]',
            'iframe[src*=bixi.alicdn.com/punish]', 'iframe[src*=punish:resource:template]', 'iframe[src*=/punish/]'
          ];
          document.querySelectorAll(selectors.join(',')).forEach(el => { try { el.remove(); } catch (_) {} });
          try { document.body && (document.body.style.overflow = ''); } catch (_) {}
        } catch (_) {}
      }

      function installBaxiaDomGuard() {
        if (window.__sycmBaxiaDomGuard) return;
        window.__sycmBaxiaDomGuard = true;

        const nativeAppendChild = Node.prototype.appendChild;
        Node.prototype.appendChild = function(node) {
          if (isBaxiaNode(node)) { setTimeout(cleanupBaxia, 0); return node; }
          return nativeAppendChild.apply(this, arguments);
        };

        const nativeInsertBefore = Node.prototype.insertBefore;
        Node.prototype.insertBefore = function(node) {
          if (isBaxiaNode(node)) { setTimeout(cleanupBaxia, 0); return node; }
          return nativeInsertBefore.apply(this, arguments);
        };

        const nativeSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function(name, value) {
          if (String(name || '').toLowerCase() === 'src' && isPunishUrl(value)) { setTimeout(cleanupBaxia, 0); return; }
          return nativeSetAttribute.apply(this, arguments);
        };

        try {
          const nativeOpen = window.open;
          window.open = function(url) { if (isPunishUrl(url)) { setTimeout(cleanupBaxia, 0); return null; } return nativeOpen.apply(this, arguments); };
        } catch (_) {}

        const startObserver = () => {
          cleanupBaxia();
          try {
            const root = document.documentElement || document;
            const mo = new MutationObserver(() => cleanupBaxia());
            mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'class', 'id', 'style'] });
          } catch (_) {}
        };
        if (document.documentElement) startObserver();
        else addEventListener('DOMContentLoaded', startObserver, { once: true });
        try { setInterval(cleanupBaxia, 1000); } catch (_) {}
      }

      try { localStorage.removeItem('debugConfig'); localStorage.removeItem('useDebug'); } catch (_) {}
      try { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true }); } catch (_) {}
      try { Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true }); } catch (_) {}

      const block = (e) => {
        const k = String(e.key || '').toLowerCase();
        if (k === 'f12' || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k)) || (e.ctrlKey && k === 'u')) e.stopImmediatePropagation();
      };
      try { addEventListener('keydown', block, true); addEventListener('keyup', block, true); addEventListener('keypress', block, true); } catch (_) {}

      try { Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth + 8, configurable: true }); } catch (_) {}
      try { Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 118, configurable: true }); } catch (_) {}
      try { Object.defineProperty(Document.prototype, 'hidden', { get: () => false, configurable: true }); } catch (_) {}
      try { Object.defineProperty(Document.prototype, 'visibilityState', { get: () => 'visible', configurable: true }); } catch (_) {}
      try { document.hasFocus = new Proxy(document.hasFocus, { apply: () => true }); } catch (_) {}

      installRecoveredViewGuard();
      cleanupRecoveredItemRank();
      installPressureDomGuard();
      installBaxiaDomGuard();
      cleanupBaxia();
      cleanupPressureText();
      renderRecoveredItemRank();

      function cleanFetchFromRealm() {
        try {
          try {
            if (window.__sycmCleanFetchWorker && window.__sycmCleanFetchWorker.terminate) {
              window.__sycmCleanFetchWorker.terminate();
            }
          } catch (_) {}
          window.__sycmCleanFetchWorker = null;
          window.__sycmCleanFetchCallbacks = {};

          let frame = window.__sycmCleanFetchFrame;
          if (!frame || !frame.contentWindow || !document.documentElement.contains(frame)) {
            frame = document.createElement('iframe');
            frame.setAttribute('data-sycm-clean-realm', '1');
            frame.src = 'about:blank';
            frame.style.cssText = 'display:none!important;width:0!important;height:0!important;border:0!important;position:absolute!important;left:-99999px!important;top:-99999px!important;';
            (document.documentElement || document.body || document).appendChild(frame);
            window.__sycmCleanFetchFrame = frame;
          }
          const cleanWindow = frame.contentWindow;
          const cleanFetch = cleanWindow && cleanWindow.fetch;
          if (!cleanFetch) return { fetch: null, Response: null, XMLHttpRequest: null };
          const realmFetch = function(input, init) {
            const requestUrl = typeof input === 'string' ? input : (input && input.url) || '';
            const nextInput = requestUrl ? new URL(requestUrl, location.href).href : input;
            return cleanFetch.call(cleanWindow, nextInput, init);
          };
          return { fetch: realmFetch, Response: cleanWindow.Response, XMLHttpRequest: cleanWindow.XMLHttpRequest };
        } catch (_) {
          return { fetch: null, Response: null, XMLHttpRequest: null };
        }
      }

      const hadPriorFetchHook = !!window.__sycmRankFallbackFetch || !!window.__sycmRankFallbackFetchVersion;
      const shouldInstallFetchHook = routeFallbackEnabled() || hadPriorFetchHook;
      const cleanRealm = shouldInstallFetchHook ? cleanFetchFromRealm() : { fetch: window.fetch, Response: window.Response, XMLHttpRequest: window.XMLHttpRequest };
      const NativeResponse = cleanRealm.Response || window.Response;
      const nativeFetch = cleanRealm.fetch || window.fetch;
      if (shouldInstallFetchHook) {
        window.__sycmRankFallbackFetch = true;
        window.__sycmRankFallbackFetchVersion = 4;
        window.fetch = async function(input, init) {
          const requestUrl = typeof input === 'string' ? input : (input && input.url) || '';
          const endpoint = endpointFor(requestUrl);
          const resp = await nativeFetch.apply(this, arguments);
          if (endpoint) {
            try {
              const text = await resp.clone().text();
              if (!isPunishText(text) && hasUsablePayloadText(text)) rememberCache(endpoint, requestUrl, text, 'fetch');
              if (isPunishText(text) && routeFallbackEnabled()) {
                cleanupBaxia();
                const fallback = fallbackFor(requestUrl);
                if (fallback) return new NativeResponse(fallback, { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json;charset=UTF-8' } });
              }
            } catch (_) {}
          }
          return resp;
        };
      }
      if (window.__sycmRankFallbackXHRVersion !== 4) {
        window.__sycmRankFallbackXHR = true;
        window.__sycmRankFallbackXHRVersion = 4;
        const XHR = window.XMLHttpRequest;
        const open = XHR.prototype.open;
        const send = XHR.prototype.send;
        XHR.prototype.open = function(method, url) { this.__sycm_url = String(url || ''); return open.apply(this, arguments); };
        XHR.prototype.send = function() {
          if (this.__sycm_url && endpointFor(this.__sycm_url)) {
            this.addEventListener('readystatechange', () => {
              try {
                if (this.readyState === 4 && this.responseText) {
                  const endpoint = endpointFor(this.__sycm_url);
                  if (!isPunishText(this.responseText) && hasUsablePayloadText(this.responseText)) rememberCache(endpoint, this.__sycm_url, this.responseText, 'xhr');
                  if (isPunishText(this.responseText) && routeFallbackEnabled()) {
                    cleanupBaxia();
                    const fallback = fallbackFor(this.__sycm_url);
                    if (fallback) {
                      Object.defineProperty(this, 'responseText', { get: () => fallback, configurable: true });
                      Object.defineProperty(this, 'response', { get: () => fallback, configurable: true });
                      Object.defineProperty(this, 'status', { get: () => 200, configurable: true });
                      Object.defineProperty(this, 'statusText', { get: () => 'OK', configurable: true });
                    }
                  }
                }
              } catch (_) {}
            });
          }
          return send.apply(this, arguments);
        };
      }
    } catch (_) {}
  };

  await ctx.addInitScript(installSycmPatch);
  await page.evaluate(installSycmPatch).catch(() => {});

  try {
    const client = await ctx.newCDPSession(page);
    await client.send('Debugger.setSkipAllPauses', { skip: true }).catch(() => {});
  } catch (_) {}

  return { installed: true, routeFallback: allowRouteFallback, url: page.url(), endpoints: [ITEM_RANK_ENDPOINT, MARKET_RANK_ENDPOINT], note: 'reload page to activate init script' };
}
