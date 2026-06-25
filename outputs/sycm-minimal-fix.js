#!/usr/bin/env node
// sycm-minimal-fix.js
// Windows ??????????????? sycm-minimal-fix.ps1?????????
const { spawnSync } = require('child_process');
const path = require('path');
const ps1 = path.join(__dirname, 'sycm-minimal-fix.ps1');
const r = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1], {
  stdio: 'inherit',
  windowsHide: false
});
process.exit(r.status == null ? 1 : r.status);
