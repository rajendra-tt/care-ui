// Simulates an Android on-screen keyboard: focus an input, then shrink the window height
// the way Chrome/Samsung Internet do, and check the UI keeps its size and the input stays visible.
//   node tools/check-keyboard.mjs [url]        (needs `npm run preview` running)
import { chromium } from 'playwright-core';

const URL = process.argv[2] || 'http://localhost:4173/';
const W = 1280, H = 800, KB = 360; // tablet landscape; keyboard takes ~360 px
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true });
const page = await ctx.newPage();
await page.goto(URL);
const pw = page.getByPlaceholder('Password');
await pw.waitFor();
await page.waitForTimeout(1800);

const measure = async (label) => {
  const r = await page.evaluate(() => {
    const cv = [...document.querySelectorAll('div')].find((d) => d.style.transform && d.style.transform.includes('scale'));
    const m = cv && cv.style.transform.match(/scale\(([\d.]+)\)/);
    const input = document.querySelector('input[placeholder="Password"]').getBoundingClientRect();
    return { scale: m ? +m[1] : null, inputTop: Math.round(input.top), inputBottom: Math.round(input.bottom), viewportH: window.innerHeight };
  });
  const visible = r.inputTop >= 0 && r.inputBottom <= r.viewportH;
  console.log(`${label.padEnd(26)} scale=${r.scale?.toFixed(3)}  input y=${r.inputTop}-${r.inputBottom}  viewport h=${r.viewportH}  input visible=${visible}`);
  return { ...r, visible };
};

const before = await measure('before keyboard');
await pw.tap();
await page.setViewportSize({ width: W, height: H - KB }); // keyboard opens
await page.waitForTimeout(700);
const open = await measure('keyboard open');
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
await page.setViewportSize({ width: W, height: H }); // keyboard closes (input may stay focused)
await page.waitForTimeout(500);
const closed = await measure('keyboard closed');
await page.setViewportSize({ width: 800, height: 1280 }); // rotate to portrait: must re-fit
await page.waitForTimeout(500);
const rotated = await measure('rotated to portrait');

const ok = Math.abs(open.scale - before.scale) < 0.001 && open.visible && Math.abs(closed.scale - before.scale) < 0.001 && Math.abs(rotated.scale - 800 / 1280) < 0.001;
console.log(ok ? 'PASS' : 'FAIL');
await b.close();
process.exit(ok ? 0 : 1);
