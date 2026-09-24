// Export the Charukesi loading animation as standalone animated SVG + GIF.
//
//   node tools/export-loader.mjs          ->  exports/charukesi-loader(.svg|.gif), exports/charukesi-loader-mark(.svg|.gif)
//
// Source of truth: src/components/logoLoaderMarkup.js (the same markup the app uses).
// GIF frames are rendered by headless Chrome with the CSS animations paused at exact
// timestamps (so the loop is frame-perfect), then assembled by tools/frames-to-gif.py.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { LOOP_MS, logoLoaderSvg } from '../src/components/logoLoaderMarkup.js';

const OUT = path.resolve('exports');
const FPS = 25;
const FRAME_MS = 1000 / FPS;
fs.mkdirSync(OUT, { recursive: true });

const variants = [
  { name: 'charukesi-loader', svg: logoLoaderSvg({ wordmark: true, dots: true }), scale: 1.5 },
  { name: 'charukesi-loader-mark', svg: logoLoaderSvg({ wordmark: false, dots: false }), scale: 1.5 },
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const v of variants) {
  fs.writeFileSync(path.join(OUT, `${v.name}.svg`), v.svg);

  const frameDir = path.join(OUT, `_frames_${v.name}`);
  fs.rmSync(frameDir, { recursive: true, force: true });
  fs.mkdirSync(frameDir);

  const page = await browser.newPage({ deviceScaleFactor: v.scale, viewport: { width: 400, height: 400 } });
  await page.setContent(`<!doctype html><body style="margin:0;background:#fff">${v.svg}</body>`);
  const svg = page.locator('body > svg');
  const count = Math.round(LOOP_MS / FRAME_MS);
  for (let i = 0; i < count; i++) {
    // Sample the *second* cycle so every animation-delay has already elapsed; frame 0 and the
    // frame after the last one are then identical and the GIF loops without a jump.
    const t = LOOP_MS + i * FRAME_MS;
    await page.evaluate((ms) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; }), t);
    await svg.screenshot({ path: path.join(frameDir, `f${String(i).padStart(3, '0')}.png`), animations: 'allow' });
  }
  await page.close();

  execFileSync('python', ['tools/frames-to-gif.py', frameDir, path.join(OUT, `${v.name}.gif`), String(FRAME_MS)], { stdio: 'inherit' });
  fs.rmSync(frameDir, { recursive: true, force: true });
  console.log(`${v.name}: ${count} frames`);
}
await browser.close();
