async page => {
  const cfg = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__sycm_market_rank_export_cfg') || '{}')).catch(() => ({}));
  const endpointPath = '/mc/mq/mkt/item/offline/rank.json';
  const altPaths = ['/mc/mq/mkt/item/offline/rank/search.json', '/mc/mq/mkt/item/offline/rank/purpose.json'];

  function valueOf(v) {
    if (v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, 'value')) return v.value;
    return v ?? '';
  }

  function asBool(v) {
    const x = valueOf(v);
    if (typeof x === 'boolean') return x;
    if (x === 'true') return true;
    if (x === 'false') return false;
    return !!x;
  }

  function rowsOf(payload) {
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

  function dataOf(payload) {
    if (!payload || typeof payload !== 'object') return {};
    if (payload._d && payload._d.data && !Array.isArray(payload._d.data)) return payload._d.data;
    if (payload._d && Array.isArray(payload._d.data)) return payload._d;
    if (payload.data && !Array.isArray(payload.data)) return payload.data;
    return payload;
  }

  function isPunishText(text) {
    const s = String(text || '');
    return (s.includes('rgv587_flag') && s.includes('punish')) ||
      s.includes('bixi.alicdn.com/punish') ||
      s.includes('punish:resource:template') ||
      s.includes('bxpunish') ||
      s.includes('punishURL') ||
      s.includes('baxia');
  }

  function parsePayload(text) {
    if (!text || isPunishText(text)) return null;
    try {
      const payload = JSON.parse(text);
      return rowsOf(payload).length ? payload : null;
    } catch (_) {
      return null;
    }
  }

  function normalize(payload, source, requestUrl, state) {
    const d = dataOf(payload);
    const list = rowsOf(payload);
    const page = Number(cfg.page || 1);
    const pageSize = Number(cfg.pageSize || list.length || 10);
    return {
      source,
      endpoint: ((state && state.origin) || 'https://sycm.taobao.com') + endpointPath,
      requestUrl,
      generatedAt: new Date().toISOString(),
      page,
      pageSize,
      recordCount: d.recordCount ?? d.total ?? null,
      updateTime: (payload && payload._d && payload._d.updateTime) || d.updateTime || null,
      rows: list.map((x, i) => ({
        rank: valueOf(x.cateRankId) || valueOf(x.rank) || ((page - 1) * pageSize + i + 1),
        itemId: (x.item && x.item.itemId) || valueOf(x.itemId) || '',
        title: (x.item && x.item.title) || valueOf(x.title) || '',
        pictUrl: (x.item && x.item.pictUrl) || valueOf(x.pictUrl) || '',
        detailUrl: (x.item && x.item.detailUrl) || valueOf(x.detailUrl) || '',
        shopTitle: (x.shop && x.shop.title) || valueOf(x.shopTitle) || valueOf(x.shopName) || '',
        shopUrl: (x.shop && x.shop.shopUrl) || valueOf(x.shopUrl) || '',
        sellerId: x.sellerId || (x.shop && x.shop.userId) || '',
        itemUserId: (x.item && x.item.userId) || '',
        isMonitor: asBool(x.isMonitor),
        isSelfItem: asBool(x.isSelfItem),
        uv: valueOf(x.uv),
        searchUv: valueOf(x.searchUv),
        payByrCnt: valueOf(x.payByrCnt),
        saleItemCnt: valueOf(x.saleItemCnt),
        cartByrCnt: valueOf(x.cartByrCnt),
        cltByrCnt: valueOf(x.cltByrCnt),
        payAmt: valueOf(x.payAmt),
        payItmCnt: valueOf(x.payItmCnt),
        raw: x
      }))
    };
  }

  async function getPageState() {
    return await page.evaluate(() => {
      const endpointPath = '/mc/mq/mkt/item/offline/rank.json';
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
        const cfg = JSON.parse(sessionStorage.getItem('__sycm_market_rank_export_cfg') || '{}');
        const endpointPath = '/mc/mq/mkt/item/offline/rank.json';
        const altPaths = ['/mc/mq/mkt/item/offline/rank/search.json', '/mc/mq/mkt/item/offline/rank/purpose.json'];
        const pageUrl = new URL(location.href);
        const pageParams = pageUrl.searchParams;
        const token = cfg.token || tokenFromEntries();
        const build = (path) => {
          const q = new URLSearchParams();
          const set = (name, value, fallback = '') => q.set(name, String(value ?? fallback));
          set('dateRange', cfg.dateRange || pageParams.get('dateRange') || '');
          set('dateType', cfg.dateType || pageParams.get('dateType') || 'recent7');
          set('pageSize', cfg.pageSize || 10);
          set('page', cfg.page || 1);
          set('cateId', cfg.cateId || pageParams.get('cateId') || '');
          set('rankType', cfg.rankType || 'gmv');
          set('minPrice', cfg.minPrice || '');
          set('maxPrice', cfg.maxPrice || '');
          set('priceSeg', cfg.priceSeg || '');
          set('sellerType', cfg.sellerType ?? '-1');
          set('keyWord', cfg.keyword ?? cfg.keyWord ?? '');
          set('cateFlag', cfg.cateFlag || pageParams.get('cateFlag') || '');
          set('indexCode', cfg.indexCode || (String(cfg.rankType || 'gmv') === 'add' ? 'cartByrCnt,cltByrCnt,uv' : 'payByrCnt,uv'));
          set('marketVersion', cfg.marketVersion || 'free');
          set('_', Date.now());
          if (token) q.set('token', token);
          return location.origin + path + '?' + q.toString();
        };
        return [build(endpointPath), ...altPaths.map(build)];
      }
      return {
        url: location.href,
        origin: location.origin,
        pathname: location.pathname,
        search: location.search,
        token: tokenFromEntries(),
        ua: navigator.userAgent,
        candidateUrls: makeCandidateUrls(),
        lastPayload: sessionStorage.getItem('__sycm_last_rank_payload|' + endpointPath) || sessionStorage.getItem('__sycm_last_rank_payload') || '',
        lastUrl: sessionStorage.getItem('__sycm_last_rank_url|' + endpointPath) || sessionStorage.getItem('__sycm_last_rank_url') || '',
        cacheKeys: Object.keys(localStorage).filter(k => k.includes('/mc/mq/mkt/item/offline/rank')).sort().slice(-30).map(k => ({ key: k, raw: localStorage.getItem(k) }))
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

  async function fetchInPage(url) {
    return await page.evaluate(async (url) => {
      const resp = await fetch(url, {
        credentials: 'include',
        headers: {
          'sycm-referer': '/mc/free/market_rank',
          'onetrace-card-id': '%2Fmc%2Ffree%2Fmarket_rank%7C%E5%B8%82%E5%9C%BA%E6%8E%92%E8%A1%8C-%E5%95%86%E5%93%81-%E5%95%86%E5%93%81%E6%8E%92%E8%A1%8C'
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
        'sycm-referer': '/mc/free/market_rank',
        'onetrace-card-id': '%2Fmc%2Ffree%2Fmarket_rank%7C%E5%B8%82%E5%9C%BA%E6%8E%92%E8%A1%8C-%E5%95%86%E5%93%81-%E5%95%86%E5%93%81%E6%8E%92%E8%A1%8C',
        'user-agent': state.ua
      }
    });
    const text = await resp.text();
    return { status: resp.status(), headers: await resp.headers(), text };
  }

  async function extractDomFallback(state, requestUrl) {
    const dom = await page.evaluate(() => {
      const tableText = [...document.querySelectorAll('.op-market-item-rank-table,.market-rank-table-container,table,[class*=rank-table]')].map(el => el.innerText).join('\n');
      const lines = tableText.split(/\n+/).map(s => s.trim()).filter(Boolean);
      const rows = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^(排名|商品|商品关键词|店铺|支付买家数|访客数|操作|每页显示|上一页|下一页|关注|-)$/.test(line)) continue;
        if (/^\d+$/.test(line)) continue;
        if (line.length >= 6 && !line.includes('\t')) {
          const metricWindow = lines.slice(i + 1, i + 8).filter(x => /\d|万|~|-/.test(x));
          rows.push({ title: line, uv: metricWindow.find(x => x.includes('万') || x.includes('~')) || '', source: 'dom' });
        }
        if (rows.length >= 100) break;
      }
      return { tableText, rows };
    });
    if (dom.rows && dom.rows.length) {
      return { source: 'dom-fallback', endpoint: state.origin + endpointPath, requestUrl, generatedAt: new Date().toISOString(), page: Number(cfg.page || 1), pageSize: Number(cfg.pageSize || dom.rows.length), recordCount: null, rows: dom.rows.map((x, i) => ({ rank: i + 1, ...x })) };
    }
    return null;
  }

  const state = await getPageState();
  const candidateUrls = state.candidateUrls || [];
  const attempts = [];

  for (const url of candidateUrls) {
    try {
      const r = await fetchInPage(url);
      attempts.push({ mode: 'page-fetch', url, status: r.status, punish: isPunishText(r.text), rows: rowsOf(parsePayload(r.text)).length });
      const payload = parsePayload(r.text);
      if (payload) return { ...normalize(payload, 'page-fetch', url, state), attempts };
    } catch (e) { attempts.push({ mode: 'page-fetch', url, error: e.message }); }
  }

  for (const url of candidateUrls) {
    try {
      const r = await fetchByApiRequest(url, state);
      attempts.push({ mode: 'api-request', url, status: r.status, bxpunish: (r.headers && (r.headers.bxpunish || r.headers.Bxpunish)) || '', punish: isPunishText(r.text), rows: rowsOf(parsePayload(r.text)).length });
      const payload = parsePayload(r.text);
      if (payload) return { ...normalize(payload, 'api-request', url, state), attempts };
    } catch (e) { attempts.push({ mode: 'api-request', url, error: e.message }); }
  }

  if (state.lastPayload) {
    const lastMatchesEndpoint = String(state.lastUrl || '').includes(endpointPath);
    const payload = lastMatchesEndpoint ? parsePayload(state.lastPayload) : null;
    attempts.push({ mode: 'sessionStorage-last', url: state.lastUrl, endpointMatch: lastMatchesEndpoint, rows: payload ? rowsOf(payload).length : 0 });
    if (payload) return { ...normalize(payload, 'sessionStorage-last', state.lastUrl || candidateUrls[0], state), attempts };
  }

  for (const item of state.cacheKeys.reverse()) {
    const payload = parseCacheValue(item.raw);
    attempts.push({ mode: 'localStorage', key: item.key, rows: rowsOf(payload).length });
    if (payload && rowsOf(payload).length) return { ...normalize(payload, 'localStorage', item.key, state), attempts };
  }

  const dom = await extractDomFallback(state, candidateUrls[0]);
  if (dom) return { ...dom, attempts };

  return { source: 'not-found', endpoint: state.origin + endpointPath, requestUrl: candidateUrls[0], attempts, rows: [] };
}
