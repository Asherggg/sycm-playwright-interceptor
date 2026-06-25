# sycm-export-item-rank.ps1
# Reuse current logged-in Edge + playwright-cli session to export SYCM item rank rows.
# Run sycm-minimal-fix.ps1 first when CDP/session/anti-risk patch is not active.

param(
  [string]$DateRange = '2026-06-25|2026-06-25',
  [string]$DateType = 'today',
  [int]$Page = 1,
  [int]$PageSize = 10,
  [string]$Order = 'desc',
  [string]$OrderBy = 'itmUv',
  [string]$IndexCode = 'payAmt,payItmCnt,payRate,itmUv,itemCartCnt',
  [string]$Keyword = '',
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
$RunCode = Join-Path $PSScriptRoot 'sycm-export-item-rank-run-code.js'
$DefaultUrl = 'https://sycm.taobao.com/cc/item_rank?dateRange=' + [uri]::EscapeDataString($DateRange) + '&dateType=' + [uri]::EscapeDataString($DateType)

function Invoke-PwCli {
  param([Parameter(Mandatory=$true)][string[]]$CliArgs, [switch]$AllowFail)
  $out = & playwright-cli @CliArgs 2>&1
  $code = $LASTEXITCODE
  $text = ($out | ForEach-Object { [string]$_ }) -join "`n"
  if ($code -ne 0 -and -not $AllowFail) { throw "playwright-cli $($CliArgs -join ' ') failed with exit $code`n$text" }
  return [pscustomobject]@{ Code = $code; Output = $text }
}

if (-not (Test-Path -LiteralPath $RunCode)) { throw "Missing run-code file: $RunCode" }

$test = Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'eval', 'location.href') -AllowFail
if ($test.Code -ne 0) {
  Write-Host '[1/4] Attaching to Edge CDP 9222...'
  $attach = Invoke-PwCli -CliArgs @('-s', $Session, 'attach', '--cdp', "http://127.0.0.1:$Port") -AllowFail
  if ($attach.Code -ne 0) { throw "Cannot attach. Run sycm-minimal-fix.ps1 first. Detail:`n$($attach.Output)" }
} else {
  Write-Host '[1/4] playwright-cli session is ready.'
}

$current = (Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'eval', 'location.href') -AllowFail).Output
if ($current -notmatch 'sycm\.taobao\.com') {
  Write-Host '[2/4] Opening SYCM item-rank page...'
  Invoke-PwCli -CliArgs @('-s', $Session, 'goto', $DefaultUrl) | Out-Null
  Start-Sleep -Seconds 6
} else {
  Write-Host '[2/4] Current page is SYCM.'
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

Write-Host '[3/4] Fetching item-rank rows in browser context...'
$res = Invoke-PwCli -CliArgs @('-s', $Session, '--raw', 'run-code', "--filename=$RunCode")
$data = $res.Output | ConvertFrom-Json
$jsonOut = $data | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($OutJson, $jsonOut, [System.Text.UTF8Encoding]::new($false))

$csvRows = @($data.rows) | Select-Object rank,itemId,title,itemNO,payAmt,payItmCnt,payRatePct,itmUv,itemCartCnt,payAmt_cycleCrc,payItmCnt_cycleCrc,payRate_cycleCrc,itmUv_cycleCrc,itemCartCnt_cycleCrc
$csvRows | Export-Csv -LiteralPath $OutCsv -NoTypeInformation -Encoding UTF8

Write-Host '[4/4] Done.'
Write-Host "source=$($data.source)"
Write-Host "endpoint=$($data.endpoint)"
Write-Host "rows=$(@($data.rows).Count), recordCount=$($data.recordCount)"
Write-Host "json=$OutJson"
Write-Host "csv=$OutCsv"
