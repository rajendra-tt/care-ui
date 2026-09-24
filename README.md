# CARE 2.0 – Therapist UI (v3)

Touch UI for the Charukesi CARE 2.0 rehabilitation device, built from
*Care 2.0 2nd UI Iteration*, *P007 – User Interface Asset Details* (04 Sep 2026) and the
*UI Flow* screen recording.

* Written with **React Native** components (`View`, `Text`, `Pressable`, `TextInput`, `StyleSheet`)
  rendered in the browser through **react-native-web**. Inline **HTML/SVG** is used where RN has
  no primitive: icons, the offloading gauge, the walk-speed dials and the background waves.
* Builds to a **static bundle (~550 KB, fonts included, no CDN)** that the cRIO-9056 serves.
  The cRIO does not run Node.js; the tablet/PC browser runs the UI and talks to the RT
  application through a LabVIEW Web Service (see [docs/CRIO_API.md](docs/CRIO_API.md)).
* Fixed 1280 × 800 design canvas (per P007), scaled to fit whatever screen opens it.

## Screens

| Flow | Screens |
|---|---|
| Therapist | Login → Assigned Patients (3-column card grid with search; tap a card) → Patient Home → Patient Vitals → Device Control → Select Mode (Balance / Squat / Walk + speed) → Confirm Mode → Ongoing Session (only **Break** is offered) → Break (confirm) → Break screen → Resume (confirm) / End Session (confirm) → Session Report → Save. *End session is only available from the break screen.* |
| Any time in a session | Emergency Stop (always on top, fires on press-in) → Release E-stop → break screen (Resume / End session there) |
| Admin | Welcome Admin → Patients → Patient details + session history / reports · Therapists → Therapist details → Assign patient · Device status + winch / movement jog |
| Registration | New Patient: Patient Information · Medical Information · Cardiopulmonary · Orthopedic · Neurological |

## Loading animation

`src/components/logoLoaderMarkup.js` rebuilds the Charukesi mark in SVG. The orange bar rises,
the green bar drops, the dark keys pop in, the white cross draws itself and the mark pulses,
on a 2.6 s loop with CSS only (a gentle fade when the OS asks for reduced motion).
The same markup is used as:

* **Boot splash**: injected into `index.html` at build time (Vite plugin), so it shows while the
  bundle downloads from the cRIO; faded out once the first screen renders (min. 1.4 s).
* **`<LogoLoader />` / `<LoadingOverlay />`**: shown while signing in, while connecting or
  reconnecting to the controller, while loading patients and while saving a session report.
  The overlay is never used on the session screen, because it would cover the Emergency stop.
  A lost link there shows a red banner instead.

**Exports** (in `exports/`, regenerate with `npm run export-loader`):

| File | Use |
|---|---|
| `charukesi-loader.svg` / `.gif` | Logo + CHARUKESI wordmark + dots (300×320 SVG, 450×480 GIF) |
| `charukesi-loader-mark.svg` / `.gif` | Logo mark only |

The SVGs animate by themselves in any modern browser, `<img>` tag or slide tool that renders
SVG. The GIFs have a white background (GIF has no smooth transparency), run at 25 fps and loop
seamlessly every 2.6 s.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173 and http://<this-PC-IP>:5173
npm run preview      # built app: http://localhost:4173 and http://<this-PC-IP>:4173
```

Both servers listen on `0.0.0.0` (set in `vite.config.js`), so a tablet on the same network can
open `http://<this-PC-IP>:5173`. Find the IP with `ipconfig`. Step-by-step commands, tablet access
and troubleshooting are in [docs/CARE2.0-UI-Command-Guide.docx](docs/CARE2.0-UI-Command-Guide.docx).

**On-screen keyboard (tablets):** the UI keeps its size when the keyboard opens. `index.html` asks
the browser to overlay the keyboard (`interactive-widget=resizes-visual`, Chrome for Android 108+).
For browsers that shrink the window instead, `Stage` in `src/components/Layout.jsx` keeps the
previous scale and scrolls the focused field above the keyboard. Check it with
`npm run test:keyboard` (needs `npm run preview` running).

**Full screen:** on by default. Browsers only allow full screen after a tap, so the app enters
it on the first tap and restores it on the next tap whenever the browser leaves it (many Android
browsers do when the keyboard opens). The header button (four-corner icon) switches between
**Full screen** and **Exit full screen**, and the choice is remembered on the tablet
(`src/services/fullscreen.js`, check with `npm run test:fullscreen`). Installed to the home screen,
the app opens full screen with no browser bar (`public/manifest.webmanifest`).

`public/config.js` ships with `mode: 'mock'`: a built-in simulator stands in for the cRIO so
the whole flow can be demonstrated with no hardware. Logins: `preethi / 1234` (therapist),
`admin / admin`.

## Recorded walkthrough

`recordings/CARE2.0-UI-Walkthrough-v2.mp4` (current UI: patient card grid, End session only on the break
screen) and `recordings/CARE2.0-UI-Walkthrough.mp4` (first version) are scripted runs (2.5 min, 1280×800,
H.264) of every
screen in simulator mode, with an on-screen cursor, tap ripples and captions. To re-record it
after UI changes (needs Chrome and Python with `opencv-python`; no browser download):

```bash
npm run build
npx vite preview --port 4173      # keep running in a second terminal
npm run record
```

`tools/record-walkthrough.mjs` drives Chrome through Playwright and captures frames through the
DevTools screencast API. `tools/encode-video.py` turns them into a constant 25 fps MP4.
It also works as an end-to-end smoke test, because it fails if any screen or button is missing.

## Publish on GitHub Pages (testing)

`.github/workflows/deploy-pages.yml` builds the app and publishes it to
`https://<user>.github.io/care-ui/` (simulator mode) on every push to `main`. One-time setup:
create an empty `care-ui` repository on GitHub, set **Settings → Pages → Source: GitHub Actions**,
then push this folder (`git init -b main`, `git add -A`, `git commit`, `git remote add origin …`,
`git push -u origin main`). Full steps: section 12 of the command guide. A Pages site is public.

## Build & deploy to the cRIO-9056

```bash
npm run build        # -> dist/
```

1. Edit `dist/config.js`: set `mode: 'crio'` (and `apiBase` if the page is not served by the
   same Web Service that implements the API).
2. Copy the contents of `dist/` to the target, e.g. into the **Public Content** folder of the
   LabVIEW Web Service that implements `/care/api` (simplest: same origin, no CORS), using
   WinSCP/`scp` with SSH enabled in NI MAX.
3. Open `http://<crio-ip>:<port>/<service>/<public-folder>/index.html` on the tablet. For a
   kiosk, launch the browser in full-screen/kiosk mode or use the ☰ → *Full screen* menu.

All asset paths are relative, so the bundle works from any folder. `config.js` is not
bundled: it can be changed on the target without rebuilding.

## Project layout

```
public/config.js          runtime settings (mock/cRIO, API address, poll rates, offloading limits)
src/main.jsx              AppRegistry entry (React Native style)
src/App.jsx               screen registry / router
src/state/AppState.jsx    navigation stack, user/patient, telemetry polling, sendCommand()
src/services/             api.js → crioHttp.js (LabVIEW Web Service) | crioMock.js (simulator)
src/components/           ui.jsx (pill buttons, cards, modal, jog buttons), Controls.jsx
                          (lift / movement / offloading gauge), Layout.jsx (header, stage), Icon.jsx
src/screens/              one file per screen
src/theme/tokens.js       P007 colours, font sizes, radii
docs/CRIO_API.md          HTTP contract + required RT-side safety behaviour
```

## Open items to confirm with the design team

* Tabs 2–5 of *New Patient* (Medical, Cardiopulmonary, Orthopedic, Neurological) were not shown
  in the design files; their fields are placeholders in `src/screens/AddPatient.jsx`.
* The E-stop pop-up in the designs reads *Cancel / Confirm*, and in the updated flow video *Confirm*
  returns to Select Mode. Here the stop is sent immediately on press, and the only option is
  *Release E-stop*, which leads to the break screen, so the session data is kept and can still be
  ended and saved there.
* "Create New Account" (2nd iteration login) is omitted, as in P007; accounts are managed on the controller.
* Offloading: the % is of the body weight entered in Patient vitals and the offloaded weight is capped
  at 60 kg (`maxKg` in `config.js`), so max % = 60 / body weight × 100 (72 kg → 83.33 %). The panel
  shows the live offloaded kg at the bottom. Logic: `src/services/offloading.js`.
  The value sits in a rotary knob (`Knob` in `src/components/Controls.jsx`): drag the handle round the
  dial (full sweep = the patient's limit); tapping the ring does not jump the value; ▲/▼ give single steps.
* Patient vitals accept a body weight up to 136 kg (`maxBodyWeightKg` in `config.js`), so the lowest
  offloading limit is 60 / 136 = 44.12 %.
