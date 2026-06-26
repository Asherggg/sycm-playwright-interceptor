# 生意参谋市场排行：F12 打开时导出数据

先运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\sycm-minimal-fix.ps1
```

再运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\sycm-export-market-rank.ps1
```

脚本会保持 DevTools/F12 打开，并从页面上下文、备用接口、localStorage 缓存、DOM 表格四级兜底里导出市场排行。

输出：

- `sycm-market-rank-export.json`
- `sycm-market-rank-export.csv`
