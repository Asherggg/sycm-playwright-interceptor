# SYCM 商品排行复用仓库

这个仓库放的是生意参谋商品排行的可复用脚本和说明。

## 主要文件

- `outputs/sycm-minimal-fix.ps1`：连接当前 Edge，注入最小补丁。
- `outputs/sycm-export-item-rank.ps1`：在当前登录态里导出商品排行 JSON / CSV。
- `outputs/sycm-export-item-rank-run-code.js`：Playwright CLI 调用的页面脚本。
- `outputs/README-sycm-reuse.md`：完整复用说明。

## 使用顺序

1. 先运行 `sycm-minimal-fix.ps1`
2. 再运行 `sycm-export-item-rank.ps1`
3. 需要改日期、分页、排序，直接改导出脚本参数

## 核心接口

`GET https://sycm.taobao.com/cc/item/live/view/top.json`
