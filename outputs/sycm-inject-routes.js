#!/usr/bin/env node
// ??????????? sycm-minimal-fix.js
const { spawnSync } = require('child_process');
const path = require('path');
const r = spawnSync('node', [path.join(__dirname, 'sycm-minimal-fix.js')], { stdio: 'inherit', windowsHide: false });
process.exit(r.status == null ? 1 : r.status);
