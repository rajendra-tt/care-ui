const defaults = {
  mode: 'crio',
  kiosk: true,
  onScreenKeyboard: true,
  apiBase: '',
  apiPrefix: '/api',
  statusPollMs: 250,
  jogRepeatMs: 150,
  requestTimeoutMs: 2000,
  offloading: { min: 0, step: 1, default: 20, maxKg: 60 },
  maxBodyWeightKg: 136,
};

const runtime = (typeof window !== 'undefined' && window.CARE_CONFIG) || {};

// ?mode=crio / ?mode=mock in the address bar overrides config.js (handy for testing against
// server/app.py without editing files).
try {
  const m = new URLSearchParams(window.location.search).get('mode');
  if (m === 'crio' || m === 'mock') runtime.mode = m;
} catch { /* no window */ }

export const config = {
  ...defaults,
  ...runtime,
  offloading: { ...defaults.offloading, ...(runtime.offloading || {}) },
};
