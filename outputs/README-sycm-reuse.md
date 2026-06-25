# SYCM 商品排行接口完整复用流程

## 1. 先准备登录态和补丁

在当前 Edge 已登录生意参谋的前提下，先运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\sycm-minimal-fix.ps1
```

这一步会连接当前 Edge CDP，注入补丁，并确认 F12+刷新后仍能看到商品排行数据。

## 2. 再导出商品排行数据

运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\sycm-export-item-rank.ps1
```

默认导出：

- `sycm-item-rank-export.json`
- `sycm-item-rank-export.csv`

## 3. 改日期 / 分页 / 排序

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

## 4. 核心接口

```http
GET https://sycm.taobao.com/cc/item/live/view/top.json
```

关键参数：

```text
dateRange=2026-06-25|2026-06-25
dateType=today
pageSize=10
page=1
order=desc
orderBy=itmUv
indexCode=payAmt,payItmCnt,payRate,itmUv,itemCartCnt
token=<页面动态 token>
```

注意：不要在纯 Node 里裸请求。最稳的方式是在当前登录 Edge 的页面上下文里 fetch，让浏览器自动带 cookie、token、headers 和已注入的 fallback。

## 5. 字段映射

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
