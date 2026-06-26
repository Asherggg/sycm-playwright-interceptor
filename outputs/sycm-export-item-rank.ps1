# sycm-export-item-rank.ps1
# Reuse current logged-in Edge + playwright-cli session to export SYCM item-rank rows.
# It works with DevTools/F12 open by injecting sycm-cli-run-code.js first, then fetching
# item_rank data through page fetch, APIRequest fallback, localStorage fallback, and DOM fallback.

param(
  [string]$DateRange = '',
  [string]$DateType = 'today',
  [int]$Page = 1,
  [int]$PageSize = 10,
  [string]$Order = 'desc',
  [string]$OrderBy = 'itmUv',
  [string]$IndexCode = 'payAmt,payItmCnt,payRate,itmUv,itemCartCnt',
  [string]$Keyword = '',
  [bool]$OpenDevTools = $true,
  [bool]$SeedWithoutDevTools = $true,
  [switch]$SkipPatch,
  [string]$OutJson = (Join-Path $PSScriptRoot 'sycm-item-rank-export.json'),
  [string]$OutCsv = (Join-Path $PSScriptRoot 'sycm-item-rank-export.csv')
)

$ErrorActionPreference = 'Stop'
try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch {}

$Session = 'sycm'
$Port = 9222
$PatchCode = Join-Path $PSScriptRoot 'sycm-cli-run-code.js'
$RunCode = Join-Path $PSScriptRoot 'sycm-export-item-rank-run-code.js'
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
  Write-Host '[1/6] Attaching to Edge CDP 9222...'
  $attach = Invoke-PwCli -CliArgs @('-s', $Session, 'attach', '--cdp', "http://127.0.0.1:$Port") -AllowFail
  if ($attach.Code -ne 0) { throw "Cannot attach. Run sycm-minimal-fix.ps1 first. Detail:`n$($attach.Output)" }
} else {
  Write-Host '[1/6] playwright-cli session is ready.'
}

$current = (Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'eval', 'location.href') -AllowFail).Output.Trim('"')
if ($current -match 'sycm\.taobao\.com' -and $current -match '/cc/item_rank') {
  if (-not $DateRange) { $DateRange = Get-QueryValue -Url $current -Name 'dateRange' }
  if (-not $DateType) { $DateType = Get-QueryValue -Url $current -Name 'dateType' }
}
if (-not $DateRange) {
  $today = Get-Date -Format 'yyyy-MM-dd'
  $DateRange = "$today|$today"
}
if (-not $DateType) { $DateType = 'today' }
$DefaultUrl = 'https://sycm.taobao.com/cc/item_rank?dateRange=' + [uri]::EscapeDataString($DateRange) + '&dateType=' + [uri]::EscapeDataString($DateType)

if ($current -notmatch 'sycm\.taobao\.com' -or $current -notmatch '/cc/item_rank') {
  Write-Host "[2/6] Opening SYCM item-rank page: $DefaultUrl"
  Invoke-PwCli -CliArgs @('-s', $Session, 'goto', $DefaultUrl) | Out-Null
  Start-Sleep -Seconds 6
} else {
  Write-Host "[2/6] Current page is SYCM item_rank; using dateRange=$DateRange dateType=$DateType."
}

if (-not $SkipPatch) {
  Write-Host '[3/6] Injecting F12-safe item-rank patch...'
  Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'run-code', "--filename=$PatchCode") | Out-Null
} else {
  Write-Host '[3/6] Patch injection skipped by request.'
}

if ($SeedWithoutDevTools) {
  Write-Host '[4/6] Seeding item-rank cache with DevTools closed, then reopening F12...'
  $tabs = (Invoke-PwCli -CliArgs @('-s', $Session, 'tab-list') -AllowFail).Output
  if ($tabs -match 'DevTools|devtools://') {
    Invoke-PwCli -CliArgs @('-s', $Session, 'press', 'F12') -AllowFail | Out-Null
    Start-Sleep -Seconds 2
  }
  Invoke-PwCli -CliArgs @('-s', $Session, 'reload') -AllowFail | Out-Null
  Start-Sleep -Seconds 8
  # Warm the endpoint-specific localStorage cache when the non-DevTools request succeeds.
  Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'run-code', "--filename=$RunCode") -AllowFail | Out-Null
} elseif ($OpenDevTools) {
  Write-Host '[4/6] Cache seeding skipped; keeping current page as-is.'
} else {
  Write-Host '[4/6] DevTools open check skipped.'
}

if ($OpenDevTools) {
  $tabs = (Invoke-PwCli -CliArgs @('-s', $Session, 'tab-list') -AllowFail).Output
  if ($tabs -notmatch 'DevTools|devtools://') {
    Invoke-PwCli -CliArgs @('-s', $Session, 'press', 'F12') -AllowFail | Out-Null
    Start-Sleep -Seconds 2
  }
}

$cfg = [ordered]@{
  dateRange = $DateRange
  dateType = $DateType
  page = $Page
  pageSize = $PageSize
  order = $Order
  orderBy = $OrderBy
  indexCode = $IndexCode
  keyword = $Keyword
  follow = $false
}
$cfgJson = $cfg | ConvertTo-Json -Compress
$cfgLiteral = $cfgJson | ConvertTo-Json -Compress
$setExpr = "sessionStorage.setItem('__sycm_export_cfg', $cfgLiteral); 'ok'"
Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'eval', $setExpr) | Out-Null

Write-Host '[5/6] Exporting item-rank rows in current browser context...'
$res = Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'run-code', "--filename=$RunCode")
$rawJson = ($res.Output | Out-String).Trim()
$data = Get-JsonFromRaw -Raw $rawJson
if ($rawJson.StartsWith('{') -or $rawJson.StartsWith('[')) {
  [System.IO.File]::WriteAllText($OutJson, $rawJson, [System.Text.UTF8Encoding]::new($false))
} else {
  $jsonOut = $data | ConvertTo-Json -Depth 80
  [System.IO.File]::WriteAllText($OutJson, $jsonOut, [System.Text.UTF8Encoding]::new($false))
}

$csvRows = @($data.rows) | Select-Object rank,itemId,title,itemNO,payAmt,payItmCnt,payRatePct,itmUv,itemCartCnt,payAmt_cycleCrc,payItmCnt_cycleCrc,payRate_cycleCrc,itmUv_cycleCrc,itemCartCnt_cycleCrc,pictUrl,detailUrl
$csvRows | Export-Csv -LiteralPath $OutCsv -NoTypeInformation -Encoding UTF8

$rowCount = @($data.rows).Count
Write-Host '[6/6] Done.'
Write-Host "source=$($data.source)"
Write-Host "endpoint=$($data.endpoint)"
Write-Host "rows=$rowCount, recordCount=$($data.recordCount)"
Write-Host "json=$OutJson"
Write-Host "csv=$OutCsv"
if ($rowCount -le 0) { throw 'item-rank export returned 0 rows' }
