// Scripted, recorded walkthrough of the whole CARE 2.0 UI in simulator mode.
//
//   npm run build && npx vite preview --port 4173     (in another terminal)
//   node tools/record-walkthrough.mjs [url] [outDir]
//   python tools/encode-video.py <outDir>/frames recordings/CARE2.0-UI-Walkthrough.mp4
//
// Uses the locally installed Chrome (playwright-core, no browser download) and records
// through the Chrome DevTools screencast API, one JPEG per repaint with its timestamp.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.argv[2] || 'http://localhost:4173/';
const OUT = path.resolve(process.argv[3] || 'recordings/_capture');
const FRAMES = path.join(OUT, 'frames');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const W = 1280;
const H = 800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- overlay: fake cursor, tap ripple, caption pill (drawn in the page, so it is recorded) ----
const OVERLAY = () => {
  const install = () => {
    if (document.getElementById('__demo_cursor')) return;
    const css = document.createElement('style');
    css.textContent = `
      #__demo_cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(-4px,-2px);transition:transform .05s}
      .__demo_ripple{position:fixed;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;border:3px solid rgba(99,152,80,.9);z-index:2147483646;pointer-events:none;animation:__rip .55s ease-out forwards}
      @keyframes __rip{to{transform:scale(3.4);opacity:0}}
      #__demo_cap{position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:2147483645;pointer-events:none;
        background:rgba(37,66,41,.92);color:#fff;font:600 17px "Open Sans",system-ui,sans-serif;padding:9px 22px;border-radius:999px;
        box-shadow:0 6px 18px rgba(0,0,0,.25);white-space:nowrap;opacity:0;transition:opacity .3s}
      #__demo_cap.on{opacity:1}
      #__demo_cap small{font-weight:400;opacity:.8;margin-left:8px}`;
    document.head.appendChild(css);
    const c = document.createElement('div');
    c.id = '__demo_cursor';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2l18 10.5-8 1.6 4.6 8.6-3.2 1.6-4.6-8.6L3 21z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const cap = document.createElement('div');
    cap.id = '__demo_cap';
    document.body.appendChild(cap);
    const pos = window.__demoPos || { x: W / 2, y: H / 2 };
    c.style.left = pos.x + 'px';
    c.style.top = pos.y + 'px';
    window.addEventListener('mousemove', (e) => {
      window.__demoPos = { x: e.clientX, y: e.clientY };
      c.style.left = e.clientX + 'px';
      c.style.top = e.clientY + 'px';
    }, true);
    window.addEventListener('mousedown', (e) => {
      c.style.transform = 'translate(-4px,-2px) scale(.85)';
      const r = document.createElement('div');
      r.className = '__demo_ripple';
      r.style.left = e.clientX + 'px';
      r.style.top = e.clientY + 'px';
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 700);
    }, true);
    window.addEventListener('mouseup', () => { c.style.transform = 'translate(-4px,-2px)'; }, true);
    window.__cap = (html) => {
      cap.innerHTML = html || '';
      cap.classList.toggle('on', !!html);
    };
  };
  const W = 1280, H = 800; // eslint-disable-line no-shadow
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
};

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--hide-scrollbars'] });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await context.addInitScript(OVERLAY);
const page = await context.newPage();

// ---- screencast capture ----
const cdp = await context.newCDPSession(page);
const index = [];
let n = 0;
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const file = `f${String(n++).padStart(6, '0')}.jpg`;
  fs.writeFileSync(path.join(FRAMES, file), Buffer.from(data, 'base64'));
  index.push({ file, t: metadata.timestamp });
  try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch { /* closing */ }
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W, maxHeight: H, everyNthFrame: 1 });

// ---- helpers ----
let cur = { x: W / 2, y: H / 2 };
const center = async (loc) => {
  await loc.waitFor({ state: 'visible', timeout: 10000 });
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};
const moveTo = async (loc) => {
  const p = await center(loc);
  const dist = Math.hypot(p.x - cur.x, p.y - cur.y);
  await page.mouse.move(p.x, p.y, { steps: Math.max(8, Math.round(dist / 18)) });
  cur = p;
  return p;
};
const tap = async (loc, pause = 700) => {
  await moveTo(loc);
  await sleep(180);
  await page.mouse.down();
  await sleep(90);
  await page.mouse.up();
  await sleep(pause);
};
const hold = async (loc, ms, pause = 500) => {
  await moveTo(loc);
  await sleep(150);
  await page.mouse.down();
  await sleep(ms);
  await page.mouse.up();
  await sleep(pause);
};
const typeInto = async (loc, text, pause = 250) => {
  await tap(loc, 150);
  await page.keyboard.type(text, { delay: 55 });
  await sleep(pause);
};
const cap = (html) => page.evaluate((h) => window.__cap && window.__cap(h), html);
// scoped to the app root so the recording overlay (captions) can never be matched
const app = page.locator('#root');
const text = (t, opts = {}) => app.getByText(t, { exact: true, ...opts });
const ph = (t) => app.getByPlaceholder(t, { exact: true });
const btn = (name) => app.getByRole('button', { name, exact: true });

// ======================= WALKTHROUGH =======================
const t0 = Date.now();
await page.goto(URL);
await sleep(300);
await cap('CARE 2.0 · Therapist UI walkthrough <small>simulator mode</small>');
await sleep(2600); // boot splash with the animated logo

// --- Login ---
await cap('Login');
await typeInto(ph('Username'), 'preethi');
await typeInto(ph('Password'), '1234');
await tap(text('Sign In'), 1500);

// --- Add new patient ---
await cap('Assigned patients · <small>card view</small>');
await sleep(1800);
await typeInto(ph('Search by name or patient ID…'), 'an', 900);
await cap('Assigned patients · <small>search filters the cards</small>');
await sleep(1200);
await tap(app.getByLabel('Clear search'), 900);
await cap('Assigned patients · <small>register a new patient</small>');
await tap(text('Add New Patient'), 900);
await cap('New Patient Registration · Patient Information');
await typeInto(ph('Enter patient full name'), 'Priya Nair');
await typeInto(ph('Enter age'), '47');
await tap(text('Female'), 300);
await typeInto(ph('Enter height (cm)'), '160');
await typeInto(ph('Enter weight (Kg)'), '62');
await page.mouse.wheel(0, 300);
await sleep(400);
await typeInto(ph('Enter Diagnosis'), 'Post-surgical gait training');
await sleep(500);
for (const tab of ['Medical Information', 'Cardiopulmonary', 'Orthopedic', 'Neurological']) {
  await tap(text('Next'), 0);
  await cap(`New Patient Registration · ${tab}`);
  await sleep(1100);
}
await cap('Save the new patient');
await tap(text('Save Patient'), 900);
await tap(text('Confirm'), 1400);

// --- Select patient ---
await cap('Tap a patient card to open it');
await moveTo(text('Priya Nair'));
await sleep(700);
await tap(text('Priya Nair'), 1300);

// --- Patient home / vitals ---
await cap('Patient home');
await sleep(900);
await tap(text('New Session'), 1000);
await cap('Patient vitals before the session');
await typeInto(ph('Enter BP (e.g. 120/80)'), '124/82');
await typeInto(ph('Enter SpO2 (%)'), '98');
await typeInto(ph('Enter heart rate (bpm)'), '76');
await typeInto(ph('Enter notes'), 'Comfortable, no pain reported');
await tap(text('Start Session'), 1300);

// --- Device control ---
await cap('Device control · <small>position the patient (press &amp; hold)</small>');
await hold(btn('Up'), 1300);
await hold(btn('Front'), 1100);
await cap('Offloading · <small>tap to adjust</small>');
for (let i = 0; i < 6; i++) await tap(btn('up'), 220);
await sleep(600);
await tap(text('Next'), 1300);

// --- Select mode ---
await cap('Select mode');
await tap(text('Balance'), 900);
await tap(text('Squat'), 900);
await tap(text('Walk'), 900);
await cap('Walking mode · <small>choose a speed</small>');
await tap(text('Medium'), 1000);
await tap(text('Start Exercise'), 1100);
await cap('Confirm mode');
await sleep(900);
await tap(text('Confirm'), 800);

// --- Ongoing session ---
await cap('Ongoing session · <small>live data from the controller</small>');
await sleep(4000);
await cap('While running, only Break is offered · <small>no End session</small>');
await sleep(3500);
await cap('Take a break');
await tap(text('Break'), 1100);
await tap(text('Confirm'), 1200);
await cap('Break screen · <small>Resume or End session available here</small>');
await sleep(3000);
await tap(text('Resume Session'), 1100);
await cap('Resume session');
await tap(text('Confirm'), 800);
await cap('Session resumed');
await sleep(4500);

// --- Emergency stop ---
await cap('Emergency stop · <small>motion halts on press, before the pop-up</small>');
await tap(text('Emergency stop'), 3500);
await cap('Release E-stop · <small>goes to the break screen, never auto-resumes</small>');
await tap(text('Release E-stop'), 2000);

// --- End session / report ---
await cap('End the session · <small>from the break screen</small>');
await tap(text('End session'), 1100);
await tap(text('Confirm'), 1400);
await cap('Session report · <small>post-session vitals and comments</small>');
const enter = ph('Enter');
await typeInto(enter.nth(0), '128/84');
await typeInto(enter.nth(1), '97');
await typeInto(enter.nth(2), '92');
await typeInto(ph('Therapist comments…'), 'Good tolerance at medium speed. Increase offloading next session.');
await tap(text('Save session'), 1000);
await tap(text('Confirm'), 1600);

// --- History ---
await cap('Session history');
await tap(text('Priya Nair'), 1200);
await tap(text('View History'), 1400);
await tap(text('Get Report').first(), 2500);
await tap(text('Close'), 900);

// --- Admin ---
await cap('Log out');
await tap(app.getByLabel('Menu'), 800);
await tap(text('Log out'), 1200);
await cap('Admin login');
await typeInto(ph('Username'), 'admin');
await typeInto(ph('Password'), 'admin');
await tap(text('Sign In'), 1600);
await cap('Admin · therapists');
await tap(text('Therapist'), 1300);
await tap(text('Dr. Preethi'), 1600);
await cap('Admin · assign a patient to a therapist');
await tap(text('Assign New patient'), 1500);
await tap(text('Cancel'), 900);
await tap(text('Back', { exact: true }).last(), 900);
await tap(text('Back', { exact: true }).last(), 1100);
await cap('Admin · device status and maintenance jog');
await tap(text('Device'), 1500);
await hold(btn('Up'), 1200, 1500);
await tap(text('Back', { exact: true }).last(), 1100);
await tap(text('Log Out'), 1600);
await cap('End of walkthrough');
await sleep(2200);
await cap('');
await sleep(600);

await cdp.send('Page.stopScreencast');
await sleep(300);
fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify(index));
console.log(`captured ${index.length} frames over ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${OUT}`);
await browser.close();
