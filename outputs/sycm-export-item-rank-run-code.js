async page => {
  const liveEndpointPath = '/cc/item/live/view/top.json';
  const dayEndpointPath = '/cc/item/view/top.json';
  const focusLiveEndpointPath = '/cc/item/view/foucs/live.json';
  const focusDayEndpointPath = '/cc/item/view/foucs.json';
  const cfg = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__sycm_export_cfg') || '{}')).catch(() => ({}));
  const endpointPath = cfg.dateType && cfg.dateType !== 'today' ? dayEndpointPath : liveEndpointPath;

  function valueOf(v) {
    if (v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, 'value')) return v.value;
    return v ?? '';
  }

  function rowsOf(payload) {
    if (!payload || typeof payload !== 'object') return [];
    const candidates = [
      payload && payload._d && payload._d.data && payload._d.data.data && payload._d.data.data.data,
      payload && payload._d && payload._d.data && payload._d.data.data,
      payload && payload._d && payload._d.data,
      payload && payload.data && payload.data.data && payload.data.data.data,
      payload && payload.data && payload.data.data,
      payload && payload.data,
      payload && payload.list,
      payload && payload.result
    ];
    for (const value of candidates) if (Array.isArray(value)) return value;
    return [];
  }

  function dataOf(payload) {
    if (!payload || typeof payload !== 'object') return {};
    if (payload._d && payload._d.data && payload._d.data.data && !Array.isArray(payload._d.data.data)) return payload._d.data.data;
    if (payload._d && payload._d.data && !Array.isArray(payload._d.data)) return payload._d.data;
    if (payload._d && Array.isArray(payload._d.data)) return payload._d;
    if (payload.data && payload.data.data && !Array.isArray(payload.data.data)) return payload.data.data;
    if (payload.data && !Array.isArray(payload.data)) return payload.data;
    return payload;
  }

  function isRiskText(text) {
    const s = String(text || '');
    return (s.includes('rgv587_flag') && s.includes('punish')) ||
      s.includes('bixi.alicdn.com/punish') ||
      s.includes('punish:resource:template') ||
      s.includes('bxpunish') ||
      s.includes('punishURL') ||
      s.includes('baxia') ||
      s.includes('压力山大') ||
      s.includes('稍后再试') ||
      s.includes('安全提示') ||
      s.includes('异常访问行为') ||
      s.includes('高频/脚本访问') ||
      s.includes('安装插件') ||
      s.includes('账号共享') ||
      s.includes('限制访问') ||
      s.includes('请规范使用');
  }

  function hasRiskHeaders(headers) {
    const h = headers || {};
    const joined = Object.keys(h).map(k => k + ':' + h[k]).join('\n').toLowerCase();
    return joined.includes('bxpunish') || joined.includes('bixi.alicdn.com/punish') || joined.includes('punish');
  }

  function parsePayload(text, headers) {
    if (!text || isRiskText(text) || hasRiskHeaders(headers)) return null;
    try {
      const payload = JSON.parse(text);
      return rowsOf(payload).length ? payload : null;
    } catch (_) {
      return null;
    }
  }

  function normalize(payload, source, requestUrl, state, attempts) {
    const d = dataOf(payload);
    const list = rowsOf(payload);
    const pageNo = Number(cfg.page || 1);
    const pageSize = Number(cfg.pageSize || list.length || 10);
    return {
      source,
      endpoint: ((state && state.origin) || 'https://sycm.taobao.com') + endpointPath,
      requestUrl,
      generatedAt: new Date().toISOString(),
      page: pageNo,
      pageSize,
      recordCount: d.recordCount ?? d.total ?? null,
      updateTime: (payload && payload._d && payload._d.updateTime) || d.updateTime || null,
      attempts,
      rows: list.map((x, i) => ({
        rank: valueOf(x.rank) || ((pageNo - 1) * pageSize + i + 1),
        itemId: (x.item && x.item.itemId) || valueOf(x.itemId) || '',
        title: (x.item && x.item.title) || valueOf(x.title) || '',
        itemNO: (x.item && x.item.itemNO) || valueOf(x.itemNO) || '',
        pictUrl: (x.item && x.item.pictUrl) || valueOf(x.pictUrl) || '',
        detailUrl: (x.item && x.item.detailUrl) || valueOf(x.detailUrl) || '',
        payAmt: valueOf(x.payAmt),
        payAmt_cycleCrc: x.payAmt && x.payAmt.cycleCrc,
        payItmCnt: valueOf(x.payItmCnt),
        payItmCnt_cycleCrc: x.payItmCnt && x.payItmCnt.cycleCrc,
        payRate: valueOf(x.payRate),
        payRatePct: x.payRate && typeof x.payRate.value === 'number' ? x.payRate.value * 100 : null,
        payRate_cycleCrc: x.payRate && x.payRate.cycleCrc,
        itmUv: valueOf(x.itmUv),
        itmUv_cycleCrc: x.itmUv && x.itmUv.cycleCrc,
        itemCartCnt: valueOf(x.itemCartCnt),
        itemCartCnt_cycleCrc: x.itemCartCnt && x.itemCartCnt.cycleCrc,
        raw: x
      }))
    };
  }

  async function getPageState() {
    return await page.evaluate(() => {
      const liveEndpointPath = '/cc/item/live/view/top.json';
      const dayEndpointPath = '/cc/item/view/top.json';
      const cfg = JSON.parse(sessionStorage.getItem('__sycm_export_cfg') || '{}');
      const pageUrl = new URL(location.href);
      const pageParams = pageUrl.searchParams;
      const dateType = cfg.dateType || pageParams.get('dateType') || 'today';
      const endpointPath = dateType && dateType !== 'today' ? dayEndpointPath : liveEndpointPath;
      function tokenFromEntries() {
        try {
          const urls = performance.getEntriesByType('resource').map(e => e.name).reverse();
          for (const u of urls) {
            try {
              if (u.includes('sycm.taobao.com/') && u.includes('token=')) {
                const token = new URL(u, location.href).searchParams.get('token');
                if (token) return token;
              }
            } catch (_) {}
          }
        } catch (_) {}
        return '';
      }
      function makeCandidateUrls() {
        const token = cfg.token || tokenFromEntries();
        const q = new URLSearchParams();
        const set = (name, value, fallback = '') => q.set(name, String(value ?? fallback));
        set('dateRange', cfg.dateRange || pageParams.get('dateRange') || '');
        set('dateType', dateType);
        set('pageSize', cfg.pageSize || 10);
        set('page', cfg.page || 1);
        set('order', cfg.order || 'desc');
        set('orderBy', cfg.orderBy || 'itmUv');
        set('keyword', cfg.keyword ?? '');
        set('follow', cfg.follow ?? false);
        set('cateId', cfg.cateId || pageParams.get('cateId') || '');
        set('cateLevel', cfg.cateLevel || pageParams.get('cateLevel') || '');
        set('indexCode', cfg.indexCode || 'payAmt,payItmCnt,payRate,itmUv,itemCartCnt');
        set('_', Date.now());
        if (token) q.set('token', token);
        return [location.origin + endpointPath + '?' + q.toString()];
      }
      const bodyText = document.body ? (document.body.innerText || '') : '';
      const riskWords = ['压力山大', '稍后再试', '安全提示', '异常访问行为', '高频/脚本访问', '安装插件', '账号共享', '限制访问', '请规范使用', 'bixi.alicdn.com/punish', 'punish:resource:template', 'baxia', 'rgv587_flag'];
      return {
        url: location.href,
        origin: location.origin,
        pathname: location.pathname,
        search: location.search,
        token: tokenFromEntries(),
        ua: navigator.userAgent,
        riskVisible: riskWords.some(x => bodyText.includes(x)),
        candidateUrls: makeCandidateUrls(),
        endpointPath,
        lastPayload: sessionStorage.getItem('__sycm_last_rank_payload|' + endpointPath) || sessionStorage.getItem('__sycm_last_rank_payload') || '',
        lastUrl: sessionStorage.getItem('__sycm_last_rank_url|' + endpointPath) || sessionStorage.getItem('__sycm_last_rank_url') || '',
        cacheKeys: Object.keys(localStorage).filter(k => k.includes(endpointPath)).sort().slice(-50).map(k => ({ key: k, raw: localStorage.getItem(k) }))
      };
    });
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

  function cacheParamMatches(key, name, value) {
    if (value == null || value === '') return true;
    const raw = name + '=' + String(value);
    const enc = name + '=' + encodeURIComponent(String(value));
    return key.includes(raw) || key.includes(enc);
  }

  function cacheMatchesCandidate(key, state) {
    const url = (state && state.candidateUrls && state.candidateUrls[0]) || '';
    try {
      const u = new URL(url);
      for (const name of ['dateRange', 'dateType']) {
        const value = u.searchParams.get(name) || '';
        if (value && !cacheParamMatches(key, name, value)) return false;
      }
      for (const name of ['page', 'pageSize', 'order', 'orderBy', 'keyword', 'follow', 'cateId', 'cateLevel', 'indexCode']) {
        const value = u.searchParams.get(name);
        if (value && !cacheParamMatches(key, name, value)) return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function cacheScore(key, state) {
    let score = key.includes('__sycm_interceptor_cache|') ? 100 : 0;
    const url = (state && state.candidateUrls && state.candidateUrls[0]) || '';
    try {
      const u = new URL(url);
      for (const [name, value] of u.searchParams.entries()) {
        if (value && cacheParamMatches(key, name, value)) score += 1;
      }
    } catch (_) {}
    for (const name of ['dateRange', 'dateType', 'page', 'pageSize', 'orderBy']) {
      const value = cfg[name];
      if (value && cacheParamMatches(key, name, value)) score += 2;
    }
    return score;
  }

  function itemAlternateUrls(url) {
    const source = String(url || '');
    const out = [];
    const orderedPaths = endpointPath === liveEndpointPath ?
      [focusLiveEndpointPath, focusDayEndpointPath] :
      [focusDayEndpointPath, focusLiveEndpointPath];
    for (const path of orderedPaths) {
      let alt = source.replace(/\/cc\/item\/(?:live\/view\/top|view\/top)\.json/, path);
      if (alt === source) continue;
      alt = alt
        .replace(/([?&])follow=[^&]*&?/g, '$1')
        .replace(/[?&]$/, '')
        .replace('?&', '?');
      if (path === focusLiveEndpointPath) {
        alt = alt.includes('dateType=') ? alt.replace(/dateType=[^&]*/, 'dateType=today') : alt + (alt.includes('?') ? '&' : '?') + 'dateType=today';
      }
      out.push(alt);
    }
    return [...new Set(out)];
  }

  function pathFromUrlText(url) {
    const m = String(url || '').match(/^https?:\/\/[^/]+([^?#]+)/);
    return m ? m[1] : String(url || '').split('?')[0];
  }

  async function rememberExportCache(endpoint, requestUrl, text, source) {
    if (!parsePayload(text, {})) return;
    await page.evaluate(({ endpoint, requestUrl, text, source }) => {
      try {
        const value = JSON.parse(text);
        const body = JSON.stringify({ value, source, savedAt: Date.now() });
        const packed = JSON.stringify(String(body.length) + '|' + body);
        const u = new URL(requestUrl, location.href);
        const key = '__sycm_interceptor_cache|' + endpoint + '|' + u.pathname + '?' + u.searchParams.toString();
        localStorage.setItem(key, packed);
        sessionStorage.setItem('__sycm_last_rank_payload|' + endpoint, text);
        sessionStorage.setItem('__sycm_last_rank_url|' + endpoint, requestUrl);
        sessionStorage.setItem('__sycm_last_rank_payload', text);
        sessionStorage.setItem('__sycm_last_rank_url', requestUrl);
      } catch (_) {}
    }, { endpoint, requestUrl, text, source });
  }

  async function fetchInPage(url) {
    return await page.evaluate(async (url) => {
      const resp = await fetch(url, {
        credentials: 'include',
        headers: {
          'sycm-referer': '/cc/item_rank',
          'onetrace-card-id': 'sycm-cc-item-rank.%2Fcc%2Fitem_rank'
        }
      });
      const text = await resp.text();
      return { status: resp.status, headers: Object.fromEntries(resp.headers.entries()), text };
    }, url);
  }

  async function fetchByApiRequest(url, state) {
    const resp = await page.context().request.get(url, {
      headers: {
        referer: state.url,
        'sycm-referer': '/cc/item_rank',
        'onetrace-card-id': 'sycm-cc-item-rank.%2Fcc%2Fitem_rank',
        'user-agent': state.ua
      }
    });
    const text = await resp.text();
    return { status: resp.status(), headers: await resp.headers(), text };
  }

  async function extractDomFallback(state, requestUrl, attempts) {
    const dom = await page.evaluate(() => {
      const bodyText = document.body ? document.body.innerText || '' : '';
      const pressureVisible = /压力山大|稍后再试|安全提示|异常访问行为|高频\/脚本访问|安装插件|账号共享|限制访问|请规范使用/.test(bodyText);
      const selectors = [
        'table tbody tr', '[class*=ant-table-row]', '[class*=next-table-row]',
        '[class*=table-row]', '[class*=rank-table] [class*=row]'
      ];
      const seen = new Set();
      const rows = [];
      const pushText = text => {
        text = String(text || '').replace(/\s+/g, ' ').trim();
        if (!text || seen.has(text)) return;
        if (/压力山大|稍后再试|安全提示|异常访问行为|高频\/脚本访问|安装插件|账号共享|限制访问|请规范使用|首页 营销 交易|商品排行 统计时间|阿里巴巴集团|许可证|为何手动汇总/.test(text)) return;
        seen.add(text);
        const idMatch = text.match(/(?:ID[:：]?\s*)?(\d{8,})/);
        const metricCount = (text.match(/支付|访客|加购|转化|金额|件数|¥|￥|\d{1,3}(,\d{3})*(\.\d+)?/g) || []).length;
        if (!idMatch || metricCount < 2) return;
        if (/^\d+$/.test(text.replace(/\s+/g, ''))) return;
        rows.push({ itemId: idMatch[1], title: text.slice(0, 160), metricsText: text });
      };
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach(el => pushText(el.innerText || el.textContent || ''));
        if (rows.length >= 100) break;
      }
      return { pressureVisible, rows: pressureVisible ? [] : rows.slice(0, 100), bodyPreview: bodyText.slice(0, 1000) };
    });
    attempts.push({ mode: 'dom-probe', pressureVisible: !!dom.pressureVisible, rows: dom.rows ? dom.rows.length : 0 });
    if (dom.rows && dom.rows.length) {
      return {
        source: 'dom-fallback',
        endpoint: state.origin + endpointPath,
        requestUrl,
        generatedAt: new Date().toISOString(),
        page: Number(cfg.page || 1),
        pageSize: Number(cfg.pageSize || dom.rows.length),
        recordCount: null,
        attempts,
        rows: dom.rows.map((x, i) => ({ rank: i + 1, ...x }))
      };
    }
    return null;
  }

  const state = await getPageState();
  const candidateUrls = state.candidateUrls || [];
  const attempts = [{ mode: 'page-state', url: state.url, riskVisible: !!state.riskVisible, cacheKeys: (state.cacheKeys || []).length }];

  for (const url of candidateUrls) {
    try {
      const r = await fetchInPage(url);
      const payload = parsePayload(r.text, r.headers);
      attempts.push({ mode: 'page-fetch', url, status: r.status, risk: isRiskText(r.text) || hasRiskHeaders(r.headers), rows: payload ? rowsOf(payload).length : 0 });
      if (payload) {
        await rememberExportCache(endpointPath, url, r.text, 'item-export-page-fetch');
        return normalize(payload, 'page-fetch', url, state, attempts);
      }
    } catch (e) { attempts.push({ mode: 'page-fetch', url, error: e.message }); }
  }

  for (const url of candidateUrls) {
    try {
      const r = await fetchByApiRequest(url, state);
      const payload = parsePayload(r.text, r.headers);
      attempts.push({ mode: 'api-request', url, status: r.status, bxpunish: (r.headers && (r.headers.bxpunish || r.headers.Bxpunish)) || '', risk: isRiskText(r.text) || hasRiskHeaders(r.headers), rows: payload ? rowsOf(payload).length : 0 });
      if (payload) {
        await rememberExportCache(endpointPath, url, r.text, 'item-export-api-request');
        return normalize(payload, 'api-request', url, state, attempts);
      }
    } catch (e) { attempts.push({ mode: 'api-request', url, error: e.message }); }
  }

  for (const originalUrl of candidateUrls) {
    for (const url of itemAlternateUrls(originalUrl)) {
      try {
        const r = await fetchByApiRequest(url, state);
        const payload = parsePayload(r.text, r.headers);
        attempts.push({ mode: 'api-request-alternate', url, cacheUrl: originalUrl, status: r.status, bxpunish: (r.headers && (r.headers.bxpunish || r.headers.Bxpunish)) || '', risk: isRiskText(r.text) || hasRiskHeaders(r.headers), rows: payload ? rowsOf(payload).length : 0 });
        if (payload) {
          await rememberExportCache(endpointPath, originalUrl, r.text, 'item-export-alternate:' + pathFromUrlText(url));
          return normalize(payload, 'api-request-alternate', url, state, attempts);
        }
      } catch (e) { attempts.push({ mode: 'api-request-alternate', url, cacheUrl: originalUrl, error: e.message }); }
    }
  }

  if (state.lastPayload) {
    const lastMatchesEndpoint = String(state.lastUrl || '').includes(endpointPath);
    const payload = lastMatchesEndpoint ? parsePayload(state.lastPayload, {}) : null;
    attempts.push({ mode: 'sessionStorage-last', url: state.lastUrl, endpointMatch: lastMatchesEndpoint, rows: payload ? rowsOf(payload).length : 0 });
    if (payload) return normalize(payload, 'sessionStorage-last', state.lastUrl || candidateUrls[0], state, attempts);
  }

  const cacheItems = [...(state.cacheKeys || [])].sort((a, b) => cacheScore(b.key, state) - cacheScore(a.key, state));
  for (const item of cacheItems) {
    if (!cacheMatchesCandidate(item.key, state)) {
      attempts.push({ mode: 'localStorage-skip-stale', key: item.key, reason: 'request-mismatch' });
      continue;
    }
    const payload = parseCacheValue(item.raw);
    attempts.push({ mode: 'localStorage', key: item.key, rows: rowsOf(payload).length });
    if (payload && rowsOf(payload).length) return normalize(payload, 'localStorage', item.key, state, attempts);
  }

  const dom = await extractDomFallback(state, candidateUrls[0], attempts);
  if (dom) return dom;

  return { source: state.riskVisible ? 'not-found-risk-visible' : 'not-found', endpoint: state.origin + endpointPath, requestUrl: candidateUrls[0], attempts, rows: [] };
}
