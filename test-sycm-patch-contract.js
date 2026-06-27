const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const patchFile = path.join(root, 'outputs', 'sycm-cli-run-code.js');
const patchSource = fs.readFileSync(patchFile, 'utf8');
const ps1File = path.join(root, 'outputs', 'sycm-minimal-fix.ps1');
const ps1Source = fs.readFileSync(ps1File, 'utf8');
const marketPs1File = path.join(root, 'outputs', 'sycm-export-market-rank.ps1');
const marketRunCodeFile = path.join(root, 'outputs', 'sycm-export-market-rank-run-code.js');
const itemPs1File = path.join(root, 'outputs', 'sycm-export-item-rank.ps1');
const itemRunCodeFile = path.join(root, 'outputs', 'sycm-export-item-rank-run-code.js');
const marketPs1Source = fs.readFileSync(marketPs1File, 'utf8');
const marketRunCodeSource = fs.readFileSync(marketRunCodeFile, 'utf8');
const itemPs1Source = fs.readFileSync(itemPs1File, 'utf8');
const itemRunCodeSource = fs.readFileSync(itemRunCodeFile, 'utf8');

for (const file of [patchFile, marketRunCodeFile, itemRunCodeFile]) {
  assert.doesNotThrow(
    () => new Function('return (' + fs.readFileSync(file, 'utf8') + ')'),
    `${path.basename(file)} must be a valid playwright-cli run-code expression`
  );
}

assert.match(
  patchSource,
  /\/mc\/mq\/mkt\/item\/offline\/rank\.json/,
  'patch must cover current market_rank item offline rank endpoint'
);

assert.match(
  patchSource,
  /\/mc\/mq\/mkt\/item\/offline\/rank\/search\.json/,
  'market_rank fallback must fetch real item ranking rows from the search endpoint'
);

assert.match(
  patchSource,
  /\/mc\/mq\/mkt\/item\/offline\/rank\/purpose\.json/,
  'market_rank fallback must cover add/purpose endpoint as an alternate source'
);

assert.match(
  patchSource,
  /page\.route/,
  'patch must install a network-level route so page JS cannot show the Baxia payload first'
);

assert.match(
  patchSource,
  /__sycm_interceptor_cache/,
  'patch must persist successful ranking payloads for later F12 bxpunish fallback'
);

assert.match(
  patchSource,
  /baxia-dialog/,
  'patch must suppress/remove Baxia risk dialog containers'
);

assert.match(
  patchSource,
  /installPressureDomGuard/,
  'patch must keep removing pressure/try-later DOM messages after older guards are installed'
);

assert.match(
  patchSource,
  /cleanupPressureText/,
  'patch must remove visible pressure/try-later text nodes from the ranking table'
);

assert.match(
  patchSource,
  /renderRecoveredItemRank/,
  'patch must render cached item-rank rows when the native table stays blank after F12 refresh'
);

assert.match(
  patchSource,
  /__sycm_item_rank_recovered/,
  'patch must add a visible recovered item-rank table container'
);

assert.match(
  patchSource,
  /ID:/,
  'recovered item-rank table must expose item IDs for verification'
);

assert.match(
  patchSource,
  /data-signature/,
  'recovered table rendering must be idempotent and avoid mutation-observer loops'
);

assert.match(
  patchSource,
  /nativeText/,
  'native row detection must exclude recovered table text so fallback stays visible'
);

assert.match(
  patchSource,
  /__sycmPressureDomGuardVersion/,
  'pressure guard must use a version marker so older init scripts cannot block upgrades'
);

assert.match(
  patchSource,
  /bixi\.alicdn\.com\/punish/,
  'patch must detect the Baxia punish payload/iframe'
);

assert.match(
  ps1Source,
  /marketRank:location\.pathname\.includes\('\/mc\/free\/market_rank'\)/,
  'PowerShell verification must detect market_rank pages'
);

assert.match(
  ps1Source,
  /baxiaCount/,
  'PowerShell verification must fail on visible Baxia dialogs'
);

assert.match(
  marketPs1Source,
  /OpenDevTools\s*=\s*\$true/,
  'market exporter must keep DevTools/F12 open by default'
);

assert.match(
  marketPs1Source,
  /sycm-export-market-rank-run-code\.js/,
  'market exporter must call its run-code implementation'
);

assert.match(
  marketRunCodeSource,
  /api-request/,
  'market exporter must include APIRequest fallback'
);

assert.match(
  marketRunCodeSource,
  /localStorage/,
  'market exporter must include localStorage fallback'
);

assert.match(
  marketRunCodeSource,
  /dom-fallback/,
  'market exporter must include DOM fallback'
);


assert.match(
  patchSource,
  /installItemRankRoute/,
  'patch must install a network-level route for the item_rank endpoint'
);

assert.match(
  patchSource,
  /压力山大.*稍后再试|稍后再试.*压力山大/s,
  'patch must treat pressure/try-later text as risk control'
);

assert.match(
  itemPs1Source,
  /OpenDevTools\s*=\s*\$true/,
  'item exporter must keep DevTools/F12 open by default'
);

assert.match(
  itemPs1Source,
  /SeedWithoutDevTools\s*=\s*\$true/,
  'item exporter must seed real item data before reopening DevTools'
);

assert.match(
  itemPs1Source,
  /sycm-cli-run-code\.js/,
  'item exporter must inject the shared F12-safe patch before exporting'
);

assert.match(
  itemRunCodeSource,
  /api-request/,
  'item exporter must include APIRequest fallback'
);

assert.match(
  itemRunCodeSource,
  /localStorage/,
  'item exporter must include localStorage fallback'
);

assert.match(
  itemRunCodeSource,
  /endpointMatch/,
  'item exporter must not accept cross-endpoint generic sessionStorage payloads'
);

assert.match(
  itemRunCodeSource,
  /dom-fallback/,
  'item exporter must include DOM fallback'
);

assert.match(
  itemRunCodeSource,
  /pressureVisible/,
  'item DOM fallback must reject pressure pages instead of exporting menu/noise rows'
);

assert.match(
  itemRunCodeSource,
  /压力山大.*稍后再试|稍后再试.*压力山大/s,
  'item exporter must detect pressure/try-later as risk control'
);

assert.match(
  patchSource,
  /\/cc\/item\/live\/view\/top\.json/,
  'patch must install a network-level route for the item_rank live endpoint'
);

assert.match(
  patchSource,
  /\/cc\/item\/view\/top\.json/,
  'patch must install a network-level route for the item_rank day/history endpoint'
);

assert.match(
  patchSource,
  /ITEM_RANK_ENDPOINTS/,
  'patch must treat live and day item-rank endpoints as one item-rank family'
);

console.log('sycm patch contract ok');
