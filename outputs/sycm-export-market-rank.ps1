# sycm-export-market-rank.ps1
# Reuse current logged-in Edge + playwright-cli session to export SYCM market-rank rows.
# It works with DevTools/F12 open by injecting sycm-cli-run-code.js first, then fetching
# market_rank data through page fetch, APIRequest fallback, localStorage fallback, and DOM fallback.

param(
  [string]$DateRange = '',
  [string]$DateType = 'recent7',
  [int]$Page = 1,
  [int]$PageSize = 10,
  [string]$CateId = '',
  [string]$ParentCateId = '',
  [string]$CateFlag = '',
  [string]$RankType = 'gmv',
  [string]$SellerType = '-1',
  [string]$MinPrice = '',
  [string]$MaxPrice = '',
  [string]$PriceSeg = '',
  [string]$Keyword = '',
  [string]$IndexCode = '',
  [string]$MarketVersion = 'free',
  [bool]$OpenDevTools = $true,
  [switch]$SkipPatch,
  [string]$OutJson = (Join-Path $PSScriptRoot 'sycm-market-rank-export.json'),
  [string]$OutCsv = (Join-Path $PSScriptRoot 'sycm-market-rank-export.csv')
)

$ErrorActionPreference = 'Stop'
try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch {}

$Session = 'sycm'
$Port = 9222
$PatchCode = Join-Path $PSScriptRoot 'sycm-cli-run-code.js'
$RunCode = Join-Path $PSScriptRoot 'sycm-export-market-rank-run-code.js'

function Invoke-PwCli {
  param([Parameter(Mandatory=$true)][string[]]$CliArgs, [switch]$AllowFail)
  $out = & playwright-cli @CliArgs 2>&1
  $code = $LASTEXITCODE
  $text = ($out | ForEach-Object { [string]$_ }) -join "`n"
  if ($code -ne 0 -and -not $AllowFail) { throw "playwright-cli $($CliArgs -join ' ') failed with exit $code`n$text" }
  return [pscustomobject]@{ Code = $code; Output = $text }
}

function Get-JsonFromRaw {
  param([string]$Raw)
  $s = ($Raw | Out-String).Trim()
  $first = $s | ConvertFrom-Json
  if ($first -is [string]) { return ($first | ConvertFrom-Json) }
  return $first
}

function Get-QueryValue {
  param([string]$Url, [string]$Name)
  try {
    Add-Type -AssemblyName System.Web -ErrorAction SilentlyContinue
    $u = [System.Uri]$Url
    $q = [System.Web.HttpUtility]::ParseQueryString($u.Query)
    return $q[$Name]
  } catch { return '' }
}

if (-not (Test-Path -LiteralPath $RunCode)) { throw "Missing run-code file: $RunCode" }
if (-not (Test-Path -LiteralPath $PatchCode)) { throw "Missing patch file: $PatchCode" }

$test = Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'eval', 'location.href') -AllowFail
if ($test.Code -ne 0) {
  Write-Host '[1/5] Attaching to Edge CDP 9222...'
  $attach = Invoke-PwCli -CliArgs @('-s', $Session, 'attach', '--cdp', "http://127.0.0.1:$Port") -AllowFail
  if ($attach.Code -ne 0) { throw "Cannot attach. Run sycm-minimal-fix.ps1 first. Detail:`n$($attach.Output)" }
} else {
  Write-Host '[1/5] playwright-cli session is ready.'
}

$current = (Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'eval', 'location.href') -AllowFail).Output.Trim('"')
if ($current -notmatch 'sycm\.taobao\.com') {
  if (-not $DateRange) { throw 'Current tab is not SYCM. Open market_rank or pass -DateRange/-CateId to build a URL.' }
  Add-Type -AssemblyName System.Web -ErrorAction SilentlyContinue
  $qs = [System.Web.HttpUtility]::ParseQueryString('')
  $qs['activeKey'] = 'item'
  $qs['dateRange'] = $DateRange
  $qs['dateType'] = $DateType
  if ($ParentCateId) { $qs['parentCateId'] = $ParentCateId }
  if ($CateId) { $qs['cateId'] = $CateId }
  if ($CateFlag) { $qs['cateFlag'] = $CateFlag }
  $url = 'https://sycm.taobao.com/mc/free/market_rank?' + $qs.ToString()
  Write-Host "[2/5] Opening market_rank page: $url"
  Invoke-PwCli -CliArgs @('-s', $Session, 'goto', $url) | Out-Null
  Start-Sleep -Seconds 6
} else {
  Write-Host '[2/5] Current page is SYCM.'
}

$current = (Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'eval', 'location.href') -AllowFail).Output.Trim('"')
if (-not $DateRange) { $DateRange = Get-QueryValue -Url $current -Name 'dateRange' }
if (-not $DateType) { $DateType = Get-QueryValue -Url $current -Name 'dateType' }
if (-not $CateId) { $CateId = Get-QueryValue -Url $current -Name 'cateId' }
if (-not $ParentCateId) { $ParentCateId = Get-QueryValue -Url $current -Name 'parentCateId' }
if (-not $CateFlag) { $CateFlag = Get-QueryValue -Url $current -Name 'cateFlag' }
if (-not $IndexCode) {
  if ($RankType -eq 'add') { $IndexCode = 'cartByrCnt,cltByrCnt,uv' } else { $IndexCode = 'payByrCnt,uv' }
}

if (-not $SkipPatch) {
  Write-Host '[3/5] Enabling export-only route fallback...'
  Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'eval', "sessionStorage.setItem('__sycm_enable_route_fallback','1'); sessionStorage.removeItem('__sycm_enable_recovered_view'); 'ok'") | Out-Null
  Write-Host '[3/5] Injecting F12-safe market-rank patch...'
  Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'run-code', "--filename=$PatchCode") | Out-Null
}

if ($OpenDevTools) {
  Write-Host '[4/5] Keeping DevTools/F12 open...'
  $tabs = (Invoke-PwCli -CliArgs @('-s', $Session, 'tab-list') -AllowFail).Output
  if ($tabs -notmatch 'DevTools|devtools://') {
    Invoke-PwCli -CliArgs @('-s', $Session, 'press', 'F12') -AllowFail | Out-Null
    Start-Sleep -Seconds 2
  }
} else {
  Write-Host '[4/5] DevTools open check skipped.'
}

$cfg = [ordered]@{
  dateRange = $DateRange
  dateType = $DateType
  page = $Page
  pageSize = $PageSize
  cateId = $CateId
  parentCateId = $ParentCateId
  cateFlag = $CateFlag
  rankType = $RankType
  sellerType = $SellerType
  minPrice = $MinPrice
  maxPrice = $MaxPrice
  priceSeg = $PriceSeg
  keyword = $Keyword
  indexCode = $IndexCode
  marketVersion = $MarketVersion
}
$cfgJson = $cfg | ConvertTo-Json -Compress
$cfgLiteral = $cfgJson | ConvertTo-Json -Compress
$setExpr = "sessionStorage.setItem('__sycm_market_rank_export_cfg', $cfgLiteral); 'ok'"
Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'eval', $setExpr) | Out-Null

Write-Host '[5/5] Exporting market-rank rows in current browser context...'
$res = Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'run-code', "--filename=$RunCode")
$rawJson = ($res.Output | Out-String).Trim()
$data = Get-JsonFromRaw -Raw $rawJson
if ($rawJson.StartsWith('{') -or $rawJson.StartsWith('[')) {
  # Keep the browser-produced UTF-8 JSON byte-for-byte; Windows PowerShell 5 can
  # corrupt Chinese strings when it reserializes deep objects with ConvertTo-Json.
  [System.IO.File]::WriteAllText($OutJson, $rawJson, [System.Text.UTF8Encoding]::new($false))
} else {
  $jsonOut = $data | ConvertTo-Json -Depth 80
  [System.IO.File]::WriteAllText($OutJson, $jsonOut, [System.Text.UTF8Encoding]::new($false))
}

$csvRows = @($data.rows) | Select-Object rank,itemId,title,shopTitle,sellerId,uv,searchUv,payByrCnt,saleItemCnt,cartByrCnt,cltByrCnt,payAmt,payItmCnt,isMonitor,isSelfItem,pictUrl,detailUrl
$csvRows | Export-Csv -LiteralPath $OutCsv -NoTypeInformation -Encoding UTF8

$rowCount = @($data.rows).Count
Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'eval', "sessionStorage.removeItem('__sycm_enable_route_fallback'); sessionStorage.removeItem('__sycm_enable_recovered_view'); 'ok'") -AllowFail | Out-Null
Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'run-code', "--filename=$PatchCode") -AllowFail | Out-Null
Write-Host 'Done.'
Write-Host "source=$($data.source)"
Write-Host "endpoint=$($data.endpoint)"
Write-Host "rows=$rowCount, recordCount=$($data.recordCount)"
Write-Host "json=$OutJson"
Write-Host "csv=$OutCsv"
if ($rowCount -le 0) { throw 'market-rank export returned 0 rows' }
