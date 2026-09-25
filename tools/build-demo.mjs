// Builds the demo version into dist-demo/: the same app, but in simulator mode (mode: 'mock'),
// so it needs no API server or cRIO. Logins: preethi / 1234, admin / admin.
//   npm run build:demo        build only
//   npm run demo              build, then serve it on http://<pc-ip>:4175
import { execSync } from 'node:child_process';
import fs from 'node:fs';

execSync('npx vite build --outDir dist-demo --emptyOutDir', { stdio: 'inherit' });

const file = 'dist-demo/config.js';
const src = fs.readFileSync(file, 'utf8');
const out = src.replace(/mode:\s*'crio'/, "mode: 'mock'");
if (!/mode:\s*'mock'/.test(out)) throw new Error(`Could not switch ${file} to simulator mode`);
fs.writeFileSync(file, `/* DEMO BUILD: simulator mode, no server needed (made by tools/build-demo.mjs). */\n${out}`);
console.log('\nDemo build ready in dist-demo/ (simulator mode).');
