/*
 * CARE 2.0 UI runtime configuration.
 * This file is NOT bundled: after deploying to the cRIO you can edit it in place.
 */
window.CARE_CONFIG = {
  // 'crio' -> call the API server (python server/app.py, or the cRIO). Default.
  // 'mock' -> built-in simulator, no server needed (used for the GitHub Pages demo).
  mode: 'crio',

  // Kiosk mode (tablet use): full screen is enforced ("Tap to continue" until it is, no "Exit full
  // screen"), and right-click, F12 / developer-tool keys, view source, reload, zoom and leaving via
  // the Back button are blocked. Set to false while developing.
  kiosk: true,

  // In-app keyboard: tablet browsers leave full screen when their own keyboard opens, so text
  // fields use this built-in keyboard instead (the tablet keyboard never opens). A hardware
  // keyboard still works. Set to false to use the tablet's own keyboard.
  onScreenKeyboard: true,

  // Where the API server is. Empty = same address as this page (`npm run dev` and `npm run preview`
  // forward /api to the Python server on port 8000). Otherwise e.g. 'http://192.168.1.50:8000'.
  apiBase: '',
  apiPrefix: '/api',

  // How often to poll GET /api/device/status for live telemetry (ms).
  statusPollMs: 250,
  // While a jog button (lift / device movement) is held, the command is re-sent at
  // this interval. The RT side should stop motion if it does not hear from the UI
  // for ~3x this interval (dead-man / watchdog).
  jogRepeatMs: 150,
  requestTimeoutMs: 2000,

  // Offloading is a percentage of the patient's body weight (from Patient vitals).
  // maxKg: hard cap on the offloaded weight (never above 60 kg). The % limit follows from it:
  // max % = maxKg / body weight x 100 (72 kg -> 83.33 %, 100 kg -> 60 %, below 60 kg -> 100 %).
  offloading: { min: 0, step: 1, default: 20, maxKg: 60 },

  // Highest body weight accepted in Patient vitals (kg).
  maxBodyWeightKg: 136,
};
