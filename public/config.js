/*
 * CARE 2.0 UI runtime configuration.
 * This file is NOT bundled: after deploying to the cRIO you can edit it in place.
 */
window.CARE_CONFIG = {
  // 'mock'  -> in-browser simulator, no hardware needed (for design review / demos)
  // 'crio'  -> talk to the LabVIEW Web Service running on the cRIO-9056
  mode: 'mock',

  // Base URL of the LabVIEW Web Service. Empty string = same host that served this page.
  // Example when the UI is opened from another machine: 'http://192.168.1.50:8001'
  apiBase: '',
  apiPrefix: '/care/api',

  // How often to poll /status for live telemetry (ms).
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
