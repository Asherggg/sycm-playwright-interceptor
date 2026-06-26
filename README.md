# SYCM 排行数据复用仓库

这个仓库放的是生意参谋商品排行 / 市场排行的可复用脚本和说明。

## 主要文件

- `outputs/sycm-minimal-fix.ps1`：连接当前 Edge，注入 F12-safe 最小补丁，并验证页面不弹 Baxia 风控。
- `outputs/sycm-export-market-rank.ps1`：在 **F12/DevTools 打开** 的当前登录态里导出市场排行 JSON / CSV。
- `outputs/sycm-export-market-rank-run-code.js`：市场排行导出逻辑，包含 page fetch / APIRequest / localStorage / DOM 四级兜底。
- `outputs/sycm-export-item-rank.ps1`：在 **F12/DevTools 打开** 的当前登录态里导出商品排行 JSON / CSV；“压力山大/稍后再试”按风控处理并走兜底。
- `outputs/sycm-export-item-rank-run-code.js`：商品排行导出逻辑。
- `outputs/README-sycm-reuse.md`：完整复用说明。

## 使用顺序

1. 先运行 `outputs/sycm-minimal-fix.ps1`
2. 市场排行运行 `outputs/sycm-export-market-rank.ps1`
3. 商品排行运行 `outputs/sycm-export-item-rank.ps1`
4. 需要改日期、分页、排序，直接改导出脚本参数

## 核心接口

```http
GET https://sycm.taobao.com/mc/mq/mkt/item/offline/rank.json
GET https://sycm.taobao.com/cc/item/live/view/top.json
```
