# SYCM 排行数据复用流程

## 1. 先准备登录态和 F12 安全补丁

在当前 Edge 已登录生意参谋的前提下，先运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\sycm-minimal-fix.ps1
```

这一步会连接当前 Edge CDP，注入补丁，并确认 **F12/DevTools 打开 + 刷新** 后仍能看到排行数据，且没有 Baxia/安全弹窗。

## 2. 导出市场排行数据（market_rank）

当前打开的是 `https://sycm.taobao.com/mc/free/market_rank?...` 时，运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\sycm-export-market-rank.ps1
```

默认会保持 F12 打开，并导出：

- `sycm-market-rank-export.json`
- `sycm-market-rank-export.csv`

示例：

```powershell
powershell -ExecutionPolicy Bypass -File .\sycm-export-market-rank.ps1 `
  -DateRange "2026-06-19|2026-06-25" `
  -DateType recent7 `
  -CateId 217309 `
  -CateFlag 2 `
  -RankType gmv `
  -Page 1 `
  -PageSize 10
```

市场排行核心接口：

```http
GET https://sycm.taobao.com/mc/mq/mkt/item/offline/rank.json
```

补丁会按顺序尝试：

1. 页面上下文 `fetch`（会经过已注入的 F12-safe route/fallback）。
2. Playwright `APIRequestContext`（复用当前登录态）。
3. 当前页面 `sessionStorage/localStorage` 的真实排行缓存。
4. 已渲染表格 DOM 兜底抽取。

因此即使 F12 打开导致原始接口返回 Baxia/punish，脚本也能从备用接口或缓存里拿到市场排名数据。

## 3. 导出商品排行数据（item_rank）

```powershell
powershell -ExecutionPolicy Bypass -File .\sycm-export-item-rank.ps1
```

脚本会保持 DevTools/F12 打开，并把“压力山大 / 稍后再试”视为风控结果；默认导出：

- `sycm-item-rank-export.json`
- `sycm-item-rank-export.csv`

示例：

```powershell
powershell -ExecutionPolicy Bypass -File .\sycm-export-item-rank.ps1 `
  -DateRange "2026-06-25|2026-06-25" `
  -DateType today `
  -Page 1 `
  -PageSize 10 `
  -OrderBy itmUv `
  -IndexCode "payAmt,payItmCnt,payRate,itmUv,itemCartCnt"
```

商品排行核心接口：

```http
GET https://sycm.taobao.com/cc/item/live/view/top.json
```

商品排行补丁会按顺序尝试：

1. 页面上下文 `fetch`（先经过已注入的 F12-safe route/fallback）。
2. Playwright `APIRequestContext`（复用当前登录态，避开 DevTools 尺寸/调试检测造成的页面风控文案）。
3. 当前页面 `sessionStorage/localStorage` 的真实排行缓存。
4. 已渲染表格 DOM 兜底抽取。

## 4. 常用字段映射

### 市场排行 `market_rank`

列表路径兼容以下返回形态：

```js
response.data.data[]
response._d.data[]
response._d.data.data[]
```

| 页面字段 | JSON 路径 |
|---|---|
| 排名 | `row.cateRankId.value` |
| 商品ID | `row.item.itemId` 或 `row.itemId.value` |
| 商品名 | `row.item.title` |
| 店铺名 | `row.shop.title` |
| 访客数 | `row.uv.value` |
| 搜索访客数 | `row.searchUv.value` |
| 支付买家数 | `row.payByrCnt.value` |
| 成交商品数 | `row.saleItemCnt.value` |
| 加购人数 | `row.cartByrCnt.value` |
| 收藏人数 | `row.cltByrCnt.value` |

### 商品排行 `item_rank`

列表路径：

```js
response._d.data.data[]
```

| 页面字段 | JSON 路径 |
|---|---|
| 商品ID | `row.item.itemId` 或 `row.itemId.value` |
| 商品名 | `row.item.title` |
| 货号 | `row.item.itemNO` |
| 支付金额 | `row.payAmt.value` |
| 支付件数 | `row.payItmCnt.value` |
| 支付转化率 | `row.payRate.value * 100` |
| 商品访客数 | `row.itmUv.value` |
| 加购件数 | `row.itemCartCnt.value` |
| 较昨日 / 环比 | 对应字段的 `cycleCrc * 100` |
