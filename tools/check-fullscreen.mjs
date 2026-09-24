// Checks the full-screen behaviour: default on, restored after the browser drops it
// (as Android browsers do when the keyboard opens), and "Exit full screen" is remembered.
//   node tools/check-fullscreen.mjs [url]        (needs `npm run preview` running)
import { chromium } from 'playwright-core';

const URL = process.argv[2] || 'http://localhost:4173/';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const page = await ctx.newPage();
let failures = 0;
const fs = () => page.evaluate(() => !!document.fullscreenElement);
const pref = () => page.evaluate(() => localStorage.getItem('care-fullscreen'));
const header = () => page.locator('[aria-label="Exit full screen"], [aria-label="Full screen"]').first().getAttribute('aria-label');
const check = async (label, expectFs) => {
  await page.waitForTimeout(400);
  const got = await fs();
  const ok = got === expectFs;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(58)} fullscreen=${got}  header="${await header()}"  pref=${await pref()}`);
};
const blank = () => page.mouse.click(640, 700); // empty background area on the login screen

await page.goto(URL);
await page.getByPlaceholder('Password').waitFor();
await page.waitForTimeout(1800);
await check('page loaded (browsers need a tap first)', false);
await blank();
await check('first tap anywhere -> full screen by default', true);
await page.getByPlaceholder('Password').tap();
await check('tap into password field keeps full screen', true);
await page.evaluate(() => document.exitFullscreen()); // what the browser does when the keyboard opens
await check('browser drops full screen (keyboard opened)', false);
await page.keyboard.type('1234');
await page.getByPlaceholder('Password').tap();
await check('tap into a field again does not fight the keyboard', false);
await blank();
await check('next tap outside the field -> full screen restored', true);
await page.locator('[aria-label="Exit full screen"]').click();
await check('header "Exit full screen" -> normal window', false);
await blank();
await check('taps no longer force full screen', false);
await page.reload();
await page.getByPlaceholder('Password').waitFor();
await page.waitForTimeout(1800);
await blank();
await check('after reload the choice is remembered', false);
await page.locator('[aria-label="Full screen"]').click();
await check('header "Full screen" -> full screen again (default back on)', true);

console.log(failures ? `FAIL (${failures})` : 'PASS');
await b.close();
process.exit(failures ? 1 : 0);
