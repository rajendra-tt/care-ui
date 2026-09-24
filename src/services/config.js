const defaults = {
  mode: 'mock',
  apiBase: '',
  apiPrefix: '/care/api',
  statusPollMs: 250,
  jogRepeatMs: 150,
  requestTimeoutMs: 2000,
  offloading: { min: 0, step: 1, default: 20, maxKg: 60 },
  maxBodyWeightKg: 136,
};

const runtime = (typeof window !== 'undefined' && window.CARE_CONFIG) || {};

export const config = {
  ...defaults,
  ...runtime,
  offloading: { ...defaults.offloading, ...(runtime.offloading || {}) },
};
