# sycm-minimal-fix.ps1
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\sycm-minimal-fix.ps1
# This connects current Edge CDP, injects the SYCM bxpunish fallback patch,
# reloads after F12, and verifies no Baxia/security popup is visible.
# For /cc/item_rank it also verifies item-rank data is visible.

$ErrorActionPreference = 'Stop'
try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch {}

$Port = 9222
$Session = 'sycm'
$Today = Get-Date -Format 'yyyy-MM-dd'
$Url = 'https://sycm.taobao.com/cc/item_rank?dateRange=' + [uri]::EscapeDataString("$Today|$Today") + '&dateType=today'
$Edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$UserData = Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\User Data'
$RunCode = Join-Path $PSScriptRoot 'sycm-cli-run-code.js'

function Test-CDP {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 2
    return ($r.StatusCode -eq 200)
  } catch { return $false }
}

function Invoke-PwCli {
  param(
    [Parameter(Mandatory=$true)][string[]]$CliArgs,
    [switch]$AllowFail
  )
  $out = & playwright-cli @CliArgs 2>&1
  $code = $LASTEXITCODE
  $text = ($out | ForEach-Object { [string]$_ }) -join "`n"
  if (($code -ne 0 -or $text -match '(^|[\r\n])\s*(SyntaxError|ReferenceError|TypeError|Error):') -and -not $AllowFail) {
    throw "playwright-cli $($CliArgs -join ' ') failed with exit $code`n$text"
  }
  return [pscustomobject]@{ Code = $code; Output = $text }
}

function Test-Session {
  $r = Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'eval', 'location.href') -AllowFail
  return ($r.Code -eq 0)
}

function Parse-VerifyJson {
  param([string]$Raw)
  $s = ($Raw | Out-String).Trim()
  $first = $s | ConvertFrom-Json
  if ($first -is [string]) { return ($first | ConvertFrom-Json) }
  return $first
}

if (-not (Test-Path -LiteralPath $RunCode)) { throw "Missing injection file: $RunCode" }

if (-not (Test-CDP)) {
  Write-Host '[1/5] CDP 9222 not found; restarting Edge with remote debugging...'
  Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Seconds 2
  if (-not (Test-Path -LiteralPath $Edge)) { throw "Edge not found: $Edge" }
  $args = "--remote-debugging-port=$Port --remote-allow-origins=* --user-data-dir=`"$UserData`" --profile-directory=Default --no-first-run --no-default-browser-check `"$Url`""
  Start-Process -FilePath $Edge -ArgumentList $args
  Start-Sleep -Seconds 8
} else {
  Write-Host '[1/5] CDP 9222 is available.'
}

if (-not (Test-CDP)) { throw 'CDP 9222 is still unavailable.' }

if (-not (Test-Session)) {
  Write-Host '[2/5] Attaching playwright-cli to current Edge...'
  $attach = Invoke-PwCli -CliArgs @('-s', $Session, 'attach', '--cdp', "http://127.0.0.1:$Port") -AllowFail
  if ($attach.Code -ne 0 -and -not (Test-Session)) {
    throw "playwright-cli attach failed:`n$($attach.Output)"
  }
} else {
  Write-Host '[2/5] playwright-cli session sycm is already attached.'
}

$current = (Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'eval', 'location.href') -AllowFail).Output
if ($current -notmatch 'sycm\.taobao\.com') {
  Write-Host '[3/5] Current tab is not SYCM; opening item-rank page...'
  Invoke-PwCli -CliArgs @('-s', $Session, 'goto', $Url) | Out-Null
  Start-Sleep -Seconds 6
} else {
  Write-Host '[3/5] Current tab is already SYCM.'
}

Write-Host '[4/5] Injecting precise fallback patch for item_rank and market_rank.'
Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'eval', "(()=>{sessionStorage.removeItem('__sycm_enable_route_fallback'); localStorage.removeItem('__sycm_enable_route_fallback'); sessionStorage.setItem('__sycm_auto_recover_item_rank','1'); localStorage.setItem('__sycm_auto_recover_item_rank','1'); sessionStorage.setItem('__sycm_enable_recovered_view','1'); localStorage.setItem('__sycm_enable_recovered_view','1'); return 'ok';})()") | Out-Null
$inject = Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'run-code', "--filename=$RunCode")
Write-Host $inject.Output

Write-Host '[5/5] Ensuring F12/DevTools is open, reloading, and verifying...'
$tabsBeforeReload = (Invoke-PwCli -CliArgs @('-s', $Session, 'tab-list') -AllowFail).Output
if ($tabsBeforeReload -notmatch 'DevTools|devtools://') {
  Invoke-PwCli -CliArgs @('-s', $Session, 'press', 'F12') -AllowFail | Out-Null
  Start-Sleep -Seconds 2
} else {
  Write-Host 'DevTools is already open.'
}
Invoke-PwCli -CliArgs @('-s', $Session, 'reload') | Out-Null
Start-Sleep -Seconds 8

$verifyExpr = "JSON.stringify((()=>{const text=document.body.innerText||'';const visibleHas=a=>a.some(x=>text.includes(x));const riskText=visibleHas(['\u5b89\u5168\u63d0\u793a','\u5f02\u5e38\u8bbf\u95ee','\u9650\u5236\u8bbf\u95ee','\u9ad8\u9891','\u811a\u672c\u8bbf\u95ee','\u8d26\u53f7\u5171\u4eab','rgv587_flag']);const pressure=visibleHas(['\u538b\u529b\u5c71\u5927','\u7a0d\u540e\u518d\u8bd5']);const baxia=[...document.querySelectorAll('iframe,div')].filter(el=>{const cls=String(el.className||'');const id=String(el.id||'');const src=String(el.src||el.getAttribute('src')||'');return cls.includes('baxia')||id.includes('baxia')||src.includes('bixi.alicdn.com/punish')||src.includes('punish:resource:template')}).length;const tableText=[...document.querySelectorAll('.op-market-item-rank-table,.market-rank-table-container,table,[class*=rank-table]')].map(el=>el.innerText).join('\n');const combinedText=text+'\n'+tableText;return {url:location.href,title:document.title,marketRank:location.pathname.includes('/mc/free/market_rank'),security:riskText||pressure||baxia>0,baxiaCount:baxia,loading:visibleHas(['\u52a0\u8f7d\u4e2d','\u8d44\u6e90\u52a0\u8f7d\u4e2d']),pressure,marketRows:(tableText.match(/\n\u5173\u6ce8/g)||[]).length,marketHasData:/\u7ade\u54c1\u5206\u6790|\u5173\u6ce8|\u4e0a\u4e00\u9875/.test(tableText),idCount:(combinedText.match(/ID:\d+/g)||[]).length,amount:/\d{1,3}(,\d{3})*\.\d{2}/.test(combinedText),sample:text.slice(0,1000),tableSample:tableText.slice(0,1000)}})())"
$result = Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'eval', $verifyExpr)
Write-Host '--- verify result ---'
Write-Host $result.Output

try {
  $obj = Parse-VerifyJson -Raw $result.Output
  if ($obj.security -or ([int]$obj.baxiaCount -gt 0)) {
    throw "verification failed: security=$($obj.security), baxiaCount=$($obj.baxiaCount)"
  }
  if (-not [bool]$obj.marketRank) {
    if ($obj.loading -or $obj.pressure -or ([int]$obj.idCount -le 0) -or (-not [bool]$obj.amount)) {
      throw "verification failed: loading=$($obj.loading), pressure=$($obj.pressure), idCount=$($obj.idCount), amount=$($obj.amount)"
    }
    Write-Host 'OK: item_rank security=false, baxiaCount=0, pressure=false, loading=false, idCount>0, amount=true.'
  } else {
    if ($obj.loading -or $obj.pressure -or (-not [bool]$obj.marketHasData) -or ([int]$obj.marketRows -le 0)) {
      throw "verification failed: loading=$($obj.loading), pressure=$($obj.pressure), marketHasData=$($obj.marketHasData), marketRows=$($obj.marketRows)"
    }
    Write-Host "OK: market_rank security=false, baxiaCount=0, marketRows=$($obj.marketRows), data visible with DevTools open."
  }
} catch {
  Write-Host "WARN: could not confirm success automatically: $($_.Exception.Message)"
  throw
}
