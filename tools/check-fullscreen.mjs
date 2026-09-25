// Checks kiosk mode: full screen enforced by the "Tap to continue" gate, restored after the browser
// drops it (as Android browsers do when the keyboard opens), no "Exit full screen" option, and
// right-click / developer-tool keys blocked.
//   node tools/check-fullscreen.mjs [url]        (needs `npm run preview` running)
import { chromium } from 'playwright-core';

const URL = process.argv[2] || 'http://localhost:4173/';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
const page = await ctx.newPage();
let failures = 0;
const result = (ok, label, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(62)} ${detail}`);
};
const fs = () => page.evaluate(() => !!document.fullscreenElement);
const gate = () => page.getByText('Tap anywhere to continue').isVisible();
const state = async (label, expectFs, expectGate) => {
  await page.waitForTimeout(900); // the gate appears after 0.7 s
  const f = await fs();
  const g = await gate();
  result(f === expectFs && g === expectGate, label, `fullscreen=${f} gate=${g}`);
};

await page.goto(URL);
await page.getByPlaceholder('Password').waitFor();
await page.waitForTimeout(1500);
await state('page loaded: gate covers the app until full screen', false, true);
await page.mouse.click(640, 400);
await state('tap on the gate -> full screen, gate gone', true, false);

// In-app keyboard: the tablet keyboard never opens, so full screen is never dropped.
const kb = page.getByRole('group', { name: 'On-screen keyboard' });
const key = (name) => kb.getByRole('button', { name, exact: true });
await page.getByPlaceholder('Username').tap();
await page.waitForTimeout(300);
result(await kb.isVisible(), 'tap a text field -> in-app keyboard opens');
result((await page.getByPlaceholder('Username').getAttribute('inputmode')) === 'none', 'tablet keyboard suppressed (inputmode="none")');
result(await page.getByPlaceholder('Username').evaluate((el) => el.readOnly), 'field read-only to the browser (iPad keeps full screen)');
for (const k of ['p', 'r', 'e', 'e', 't', 'h', 'i']) await key(k).tap();
result((await page.getByPlaceholder('Username').inputValue()) === 'preethi', 'typing on the in-app keyboard fills the field', `value="${await page.getByPlaceholder('Username').inputValue()}"`);
await key('Backspace').tap();
await key('i').tap();
result((await page.getByPlaceholder('Username').inputValue()) === 'preethi', 'backspace works');
await state('still full screen while typing', true, false);
await page.getByPlaceholder('Password').tap();
await key('123').tap();
for (const k of ['1', '2', '3', '4']) await key(k).tap();
await key('Enter').tap(); // like the Enter key: signs in
await page.waitForTimeout(1500);
result(await page.getByText('Assigned Patients').isVisible(), 'Enter on the in-app keyboard signs in');
result(!(await kb.isVisible()), 'keyboard closes when the field is left');
await state('still full screen after signing in', true, false);

// A hardware keyboard types into the read-only fields too.
const search = page.getByPlaceholder(/Search by name/);
await search.tap();
await page.keyboard.type('ram');
await page.keyboard.press('Backspace');
result((await search.inputValue()) === 'ra', 'hardware keyboard types into the field', `value="${await search.inputValue()}"`);
// Full screen lost some other way while a field is focused: the gate brings it back.
await page.evaluate(() => document.exitFullscreen());
await state('full screen lost with a field focused -> gate shown', false, true);
await page.mouse.click(640, 400);
await state('tap the gate -> full screen again', true, false);
result((await page.locator('[aria-label="Exit full screen"], [aria-label="Full screen"]').count()) === 0,
  'no "Exit full screen" / "Full screen" button in the header');

const prevented = (type, init) => page.evaluate(([t, i]) => {
  const ev = t === 'contextmenu' ? new MouseEvent(t, { bubbles: true, cancelable: true, ...i }) : new KeyboardEvent(t, { bubbles: true, cancelable: true, ...i });
  document.body.dispatchEvent(ev);
  return ev.defaultPrevented;
}, [type, init]);
result(await prevented('contextmenu', {}), 'right-click menu blocked');
result(await prevented('keydown', { key: 'F12' }), 'F12 blocked');
result(await prevented('keydown', { key: 'I', ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+I blocked');
result(await prevented('keydown', { key: 'u', ctrlKey: true }), 'Ctrl+U (view source) blocked');
result(await prevented('keydown', { key: 'r', ctrlKey: true }), 'Ctrl+R (reload) blocked');
result(!(await prevented('keydown', { key: 'a' })), 'normal typing still works');

await page.evaluate(() => document.exitFullscreen());
await state('full screen left some other way (Esc, swipe) -> gate returns', false, true);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll full-screen / kiosk checks passed');
await b.close();
process.exit(failures ? 1 : 0);
