async page => {
  return await page.evaluate(async () => {
    const cfg = JSON.parse(sessionStorage.getItem('__sycm_export_cfg') || '{}');
    const endpointPath = '/cc/item/live/view/top.json';

    function getToken() {
      try {
        const urls = performance.getEntriesByType('resource').map(e => e.name).reverse();
        for (const u of urls) {
          if (u.includes('sycm.taobao.com/') && u.includes('token=')) {
            const token = new URL(u, location.href).searchParams.get('token');
            if (token) return token;
          }
        }
      } catch (_) {}
      return '';
    }

    function parseCacheValue(raw) {
      let outer;
      try { outer = JSON.parse(raw); } catch (_) { outer = raw; }
      if (typeof outer !== 'string') return null;
      const pipe = outer.indexOf('|');
      if (pipe < 0) return null;
      const obj = JSON.parse(outer.slice(pipe + 1));
      return obj && obj.value ? obj.value : null;
    }

    function readLocalCache() {
      const dateRange = cfg.dateRange || '';
      const dateType = cfg.dateType || '';
      const page = String(cfg.page || 1);
      const pageSize = String(cfg.pageSize || 10);
      const keys = Object.keys(localStorage)
        .filter(k => k.includes(endpointPath))
        .sort((a, b) => {
          const score = k =>
            (dateRange && k.includes('dateRange=' + dateRange) ? 8 : 0) +
            (dateType && k.includes('dateType=' + dateType) ? 4 : 0) +
            (k.includes('page=' + page) ? 2 : 0) +
            (k.includes('pageSize=' + pageSize) ? 1 : 0);
          return score(b) - score(a);
        });
      for (const key of keys) {
        try {
          const val = parseCacheValue(localStorage.getItem(key));
          const rows = val && val._d && val._d.data && val._d.data.data;
          if (Array.isArray(rows) && rows.length) return { key, value: val };
        } catch (_) {}
      }
      return null;
    }

    function normalize(value, source, requestUrl) {
      const d = value && value._d && value._d.data ? value._d.data : {};
      const list = Array.isArray(d.data) ? d.data : [];
      return {
        source,
        endpoint: location.origin + endpointPath,
        requestUrl,
        recordCount: d.recordCount ?? null,
        updateTime: value && value._d ? value._d.updateTime : null,
        rows: list.map((x, i) => ({
          rank: i + 1,
          itemId: (x.item && x.item.itemId) || (x.itemId && x.itemId.value) || '',
          title: (x.item && x.item.title) || '',
          itemNO: (x.item && x.item.itemNO) || '',
          payAmt: x.payAmt && x.payAmt.value,
          payAmt_cycleCrc: x.payAmt && x.payAmt.cycleCrc,
          payItmCnt: x.payItmCnt && x.payItmCnt.value,
          payItmCnt_cycleCrc: x.payItmCnt && x.payItmCnt.cycleCrc,
          payRate: x.payRate && x.payRate.value,
          payRatePct: x.payRate && typeof x.payRate.value === 'number' ? x.payRate.value * 100 : null,
          payRate_cycleCrc: x.payRate && x.payRate.cycleCrc,
          itmUv: x.itmUv && x.itmUv.value,
          itmUv_cycleCrc: x.itmUv && x.itmUv.cycleCrc,
          itemCartCnt: x.itemCartCnt && x.itemCartCnt.value,
          itemCartCnt_cycleCrc: x.itemCartCnt && x.itemCartCnt.cycleCrc
        }))
      };
    }

    const token = cfg.token || getToken();
    const q = new URLSearchParams();
    q.set('dateRange', cfg.dateRange || '2026-06-25|2026-06-25');
    q.set('dateType', cfg.dateType || 'today');
    q.set('pageSize', String(cfg.pageSize || 10));
    q.set('page', String(cfg.page || 1));
    q.set('order', cfg.order || 'desc');
    q.set('orderBy', cfg.orderBy || 'itmUv');
    q.set('keyword', cfg.keyword || '');
    q.set('follow', String(cfg.follow ?? false));
    q.set('cateId', cfg.cateId || '');
    q.set('cateLevel', cfg.cateLevel || '');
    q.set('indexCode', cfg.indexCode || 'payAmt,payItmCnt,payRate,itmUv,itemCartCnt');
    q.set('_', String(Date.now()));
    if (token) q.set('token', token);
    const requestUrl = location.origin + endpointPath + '?' + q.toString();

    let text = '';
    try {
      const resp = await fetch(requestUrl, {
        credentials: 'include',
        headers: {
          'sycm-referer': '/cc/item_rank',
          'onetrace-card-id': 'sycm-cc-item-rank.%2Fcc%2Fitem_rank'
        }
      });
      text = await resp.text();
      const json = JSON.parse(text);
      if (json && json._d && json._d.data && Array.isArray(json._d.data.data)) {
        return normalize(json, 'fetch', requestUrl);
      }
      if (text.includes('rgv587_flag') || text.includes('bixi.alicdn.com/punish')) {
        const cache = readLocalCache();
        if (cache) return normalize(cache.value, 'localStorage-fallback-after-bxpunish', requestUrl);
      }
      return { source: 'fetch-unexpected', endpoint: location.origin + endpointPath, requestUrl, rawPreview: text.slice(0, 500), rows: [] };
    } catch (e) {
      const cache = readLocalCache();
      if (cache) return normalize(cache.value, 'localStorage-fallback-after-error:' + e.message, requestUrl);
      return { source: 'error', endpoint: location.origin + endpointPath, requestUrl, error: e.message, rows: [] };
    }
  });
}
