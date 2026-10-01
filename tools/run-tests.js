// Runs the same tests as tests.html under Node (optional; faster than the browser runner).
// Usage (from the repo root):  node tools/run-tests.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
globalThis.window = globalThis;   // the scripts attach to window
const html = fs.readFileSync(path.join(root, 'tests.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
for (const src of scripts) vm.runInThisContext(fs.readFileSync(path.join(root, src), 'utf8'), { filename: src });
const results = globalThis.T.run();
const fail = results.filter(r => !r.pass);
fail.forEach(r => console.log(`FAIL  [${r.card || r.group}] ${r.name}\n      ${r.error}`));
console.log(`${results.length - fail.length}/${results.length} tests pass, ${fail.length} fail.`);
process.exit(fail.length ? 1 : 0);
