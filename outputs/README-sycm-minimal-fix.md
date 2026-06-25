# 生意参谋商品排行：F12 后刷新仍显示数据的最小补丁

已验证场景：`https://sycm.taobao.com/cc/item_rank?...dateType=today` 页面，按 F12 后刷新，页面显示商品排行数据，且没有“安全提示/异常访问”弹窗。

## 根因

商品排行真实业务接口：

`https://sycm.taobao.com/cc/item/live/view/top.json?...`

异常时不是返回排行数据，而是返回类似下面的内容：

```json
{"rgv587_flag":"sm","url":"https://bixi.alicdn.com/punish/..."}
```

如果直接 block/mock 这个 `top.json`，前端就没有真实排行数据，所以会一直加载或空白。

## 当前修复策略

脚本不再拦截业务接口；它只做两件事：

1. 页面脚本执行前注入最小 anti-F12/anti-debug 补丁。
2. 对 `fetch/XMLHttpRequest` 做精确充值：
   - 先让 `top.json` 真实请求正常发送；
   - 如果真实响应已经是正常排行数据，完全不改；
   - 只有当响应文本包含 `rgv587_flag` + `bixi.alicdn.com/punish` 时，才从当前浏览器 `localStorage` 里读取之前缓存的真实 `top.json`，返回给前端渲染。

因此它不会再因为“把业务接口拦掉”导致商品排名加载不出来。
