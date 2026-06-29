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

for (const [name, source] of [
  ['minimal fix', ps1Source],
  ['market exporter', marketPs1Source],
  ['item exporter', itemPs1Source]
]) {
  assert.doesNotMatch(
    source,
    /'eval',\s*"(?:sessionStorage|localStorage)[^"]*;\s*/s,
    `${name} must wrap multi-statement eval snippets in an IIFE because playwright-cli --raw eval reports SyntaxError with exit 0 for raw statements`
  );
  assert.doesNotMatch(
    source,
    /\$setExpr\s*=\s*"(?:sessionStorage|localStorage)[^"]*;\s*'ok'"/s,
    `${name} must wrap export-config eval snippets in an IIFE so sessionStorage is actually written`
  );
}

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
  'patch must keep network-level route support for explicit export fallback'
);

assert.match(
  patchSource,
  /__sycm_enable_route_fallback/,
  'network route fallback must be gated behind an explicit opt-in so normal page browsing is not fulfilled from stale cache/empty fallback'
);


assert.match(
  patchSource,
  /localStorage\.getItem\(name\)/,
  'F12 recovery flags must also read localStorage because SYCM can clear sessionStorage during reload'
);

assert.match(
  patchSource,
  /cacheMatchesRequest/,
  'visible recovered rows must only use cache entries matching the current page request/date parameters'
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
  'patch may still support an opt-in recovered item-rank table for diagnostics/export fallback'
);

assert.match(
  patchSource,
  /__sycm_enable_recovered_view/,
  'recovered item-rank DOM table must be gated behind an explicit opt-in so it cannot replace normal page rendering'
);

assert.match(
  patchSource,
  /__sycm_auto_recover_item_rank/,
  'item-rank page recovery must be available without enabling network route fallback, so normal API requests are not replaced by empty responses'
);

assert.match(
  patchSource,
  /installRecoveredViewGuard/,
  'patch must actively block and remove recovered item-rank DOM inserted by older already-installed observers'
);

assert.match(
  patchSource,
  /cleanFetchFromRealm/,
  'patch must reinstall fetch from a clean browser realm so older fallback hooks cannot keep returning empty/stale data'
);

assert.match(
  patchSource,
  /data-sycm-clean-realm/,
  'clean fetch reinstall must use a same-page iframe realm instead of a worker so normal same-origin credentials/referrer semantics are preserved'
);

assert.doesNotMatch(
  patchSource,
  /new Worker/,
  'clean fetch reinstall must not replace normal page fetch with a worker fetch that can break normal ranking data loads'
);

assert.doesNotMatch(
  patchSource,
  /if\s*\(!window\.__sycmRankFallbackFetch\)/,
  'fetch fallback hook must be versioned/reinstalled instead of skipped when an older hook marker already exists'
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
  /__sycmPressureDomGuardVersion >= 3/,
  'pressure/security prompt guard must bump its version when risk-text cleanup semantics change'
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
  ps1Source,
  /combinedText=.*text.*tableText|combinedText=.*tableText.*text/s,
  'PowerShell verification must count item IDs and amounts from both body text and table container text'
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
  marketPs1Source,
  /__sycm_enable_route_fallback/,
  'market exporter must explicitly opt in to route fallback before injecting the shared patch'
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
  patchSource,
  /安全提示.*异常访问行为.*账号共享|异常访问行为.*安全提示.*账号共享/s,
  'patch must treat the SYCM security prompt text as risk control and remove its modal container'
);

assert.match(
  itemRunCodeSource,
  /安全提示.*异常访问行为.*账号共享|异常访问行为.*安全提示.*账号共享/s,
  'item exporter must classify the security prompt as risk instead of DOM data'
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

assert.ok(
  itemPs1Source.indexOf("$setExpr =") >= 0 &&
    itemPs1Source.indexOf("$setExpr =") < itemPs1Source.indexOf('[3/6] Enabling export-only route fallback'),
  'item exporter must write __sycm_export_cfg before patching/seeding so the seed run warms the requested dateType endpoint instead of defaulting to today/live'
);

assert.match(
  itemPs1Source,
  /sycm-cli-run-code\.js/,
  'item exporter must inject the shared F12-safe patch before exporting'
);

assert.match(
  itemPs1Source,
  /__sycm_enable_route_fallback/,
  'item exporter must explicitly opt in to route fallback before injecting the shared patch'
);

assert.match(
  itemPs1Source,
  /__sycm_auto_recover_item_rank/,
  'item exporter must leave item-rank auto recovery enabled after export so the visible page is not blank when F12 triggers risk'
);

assert.match(
  itemPs1Source,
  /sessionStorage\.setItem\('__sycm_enable_recovered_view'\s*,\s*'1'\)/,
  'item exporter must keep the legacy recovered-view flag on so stale installed guards cannot hide recovered item rows'
);

assert.doesNotMatch(
  ps1Source,
  /sessionStorage\.setItem\('__sycm_enable_route_fallback'\s*,\s*'1'\)/,
  'minimal page fix must not enable route fallback because it is only checking visible page behavior'
);

assert.match(
  ps1Source,
  /sessionStorage\.removeItem\('__sycm_enable_route_fallback'\)/,
  'minimal page fix must clear any stale export-only route fallback opt-in before injecting the shared patch'
);

assert.match(
  ps1Source,
  /__sycm_auto_recover_item_rank/,
  'minimal page fix must allow recovered item-rank rendering while keeping network route fallback disabled'
);

assert.match(
  ps1Source,
  /sessionStorage\.setItem\('__sycm_enable_recovered_view'\s*,\s*'1'\)/,
  'minimal page fix must also set the legacy recovered-view flag so already-installed old guards do not remove the recovered table'
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
  /localStorage-skip-stale/,
  'item exporter must reject stale localStorage rows whose date/query does not match the current export request'
);

assert.match(
  itemPs1Source,
  /No current item-rank rows exported/,
  'item exporter must fail instead of writing a successful empty or stale export when all current requests are risk-blocked'
);

assert.match(
  itemRunCodeSource,
  /const endpointPath = dateType && dateType !== 'today' \? dayEndpointPath : liveEndpointPath;[\s\S]*function makeCandidateUrls/,
  'item exporter page-state probe must define endpointPath outside makeCandidateUrls before returning it'
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
  /riskVisible:\s*riskWords\.some\(x => bodyText\.includes\(x\)\)/,
  'item exporter page-state risk check must use visible body text only so injected guard CSS containing punish keywords does not create a false risk-visible state'
);

assert.doesNotMatch(
  itemRunCodeSource,
  /riskWords\.some\(x => bodyText\.includes\(x\)\s*\|\|\s*html\.includes\(x\)\)/,
  'item exporter must not scan full outerHTML for risk words because the patch itself injects punish/baxia strings into style guards'
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
