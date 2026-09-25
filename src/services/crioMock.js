// In-browser simulator of the cRIO controller, used when CARE_CONFIG.mode === 'mock'.
// Mirrors the HTTP contract in docs/CRIO_API.md so screens never know the difference.
import { config } from './config';
import { MAX_OFFLOAD_KG } from './offloading';

const STORE_KEY = 'care-mock-db-v2';
const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

const seed = () => ({
  users: [
    { id: 'u-admin', username: 'admin', password: 'admin', name: 'Admin', role: 'admin' },
    { id: 't-1', username: 'preethi', password: '1234', name: 'Dr. Preethi', role: 'therapist' },
    { id: 't-2', username: 'arjun', password: '1234', name: 'Dr. Arjun', role: 'therapist' },
  ],
  patients: [
    { id: 'P-0001', fullName: 'Ramesh Kumar', gender: 'Male', age: 58, height: 170, weight: 72, therapistId: 't-1', diagnosis: 'Post-stroke hemiparesis' },
    { id: 'P-0002', fullName: 'Lakshmi Iyer', gender: 'Female', age: 64, height: 156, weight: 61, therapistId: 't-1', diagnosis: 'Knee replacement rehab' },
    { id: 'P-0003', fullName: 'Suresh Patil', gender: 'Male', age: 45, height: 176, weight: 84, therapistId: 't-1', diagnosis: 'Incomplete SCI (L1)' },
    { id: 'P-0004', fullName: 'Anita Desai', gender: 'Female', age: 39, height: 162, weight: 58, therapistId: 't-1', diagnosis: 'Ankle fracture' },
    { id: 'P-0005', fullName: 'Mohan Rao', gender: 'Male', age: 71, height: 168, weight: 66, therapistId: 't-2', diagnosis: "Parkinson's gait" },
    { id: 'P-0006', fullName: 'Fatima Shaikh', gender: 'Female', age: 52, height: 158, weight: 70, therapistId: 't-1', diagnosis: 'Balance disorder' },
  ],
  sessions: [
    {
      id: 'S-1001', patientId: 'P-0001', therapistId: 't-1', date: '2026-09-18', mode: 'walk', speed: 'medium',
      durationSec: 1260, pauseSec: 180, breaks: 1, fallArrests: 1, steps: 687, distanceM: 378, squats: 12,
      balanceSec: 300, walkingSec: 840, squatSec: 120,
      exercises: [{ mode: 'balance', sec: 300, speed: '' }, { mode: 'walk', sec: 840, speed: 'Medium' }, { mode: 'squat', sec: 120, speed: '' }],
      bodyWeightKg: 72, offloading: 25, offloadUnit: 'percent', avgUnloadKg: 17.3, avgUnloadPct: 24, maxUnloadKg: 21.6, minUnloadKg: 14.4,
      vitalsBefore: { bp: '128/82', spo2: '98', hr: '76', weight: '72' }, vitalsAfter: { bp: '122/78', spo2: '99', hr: '84' },
      comments: 'Completed session with minimal assistance.',
    },
    {
      id: 'S-1002', patientId: 'P-0001', therapistId: 't-1', date: '2026-09-21', mode: 'balance', speed: null,
      durationSec: 900, pauseSec: 0, breaks: 0, fallArrests: 0, steps: 0, distanceM: 0, squats: 0,
      balanceSec: 900, walkingSec: 0, squatSec: 0, exercises: [{ mode: 'balance', sec: 900, speed: '' }],
      bodyWeightKg: 72, offloading: 20, offloadUnit: 'percent', avgUnloadKg: 14.4, avgUnloadPct: 20, maxUnloadKg: 14.4, minUnloadKg: 14.4,
      vitalsBefore: { bp: '126/80', spo2: '98', hr: '74', weight: '72' }, vitalsAfter: { bp: '124/80', spo2: '98', hr: '80' },
      comments: '',
    },
  ],
});

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* storage unavailable: fall back to in-memory */ }
  return seed();
}
let db = load();
const persist = () => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch { /* ignore */ }
};

// ---- simulated device -------------------------------------------------------
const dev = {
  state: 'idle', // idle | running | break | estop
  preEstop: 'idle',
  mode: null, // balance | squat | walk
  speed: 'slow',
  offloading: config.offloading.default,
  offloadUnit: 'percent',
  liftPosition: 50, // 0..100 %
  position: { x: 0, y: 0 },
  battery: 86,
  durationSec: 0,
  steps: 0,
  squats: 0,
  fallArrests: 0,
  breaks: 0,
  distanceM: 0,
  speedMps: 0,
  bodyWeight: null,
  // report totals (same as the server): time per exercise, pauses, time-weighted unloading
  modeSec: {},
  walkSpeeds: [],
  pauseSec: 0,
  unloadKgSec: 0,
  maxKg: null,
  minKg: null,
  lastTick: Date.now(),
};

const unloadKg = () => (dev.offloadUnit === 'kg' ? dev.offloading : dev.bodyWeight ? (dev.offloading / 100) * dev.bodyWeight : null);
const SPEEDS = { slow: 0.35, medium: 0.6, fast: 0.9 };

function tick() {
  const now = Date.now();
  const dt = (now - dev.lastTick) / 1000;
  dev.lastTick = now;
  if (dev.state !== 'running') {
    dev.speedMps = 0;
    if (dev.sessionId && (dev.state === 'break' || dev.state === 'estop')) dev.pauseSec += dt;
    return;
  }
  dev.durationSec += dt;
  if (dev.mode) dev.modeSec[dev.mode] = (dev.modeSec[dev.mode] || 0) + dt;
  const kg = unloadKg();
  if (kg != null && dt > 0) {
    dev.unloadKgSec += kg * dt;
    dev.maxKg = dev.maxKg == null ? kg : Math.max(dev.maxKg, kg);
    dev.minKg = dev.minKg == null ? kg : Math.min(dev.minKg, kg);
  }
  if (dev.mode === 'walk') {
    dev.speedMps = SPEEDS[dev.speed] * (0.9 + Math.random() * 0.2);
    dev.distanceM += dev.speedMps * dt;
    dev.steps = Math.floor(dev.distanceM / 0.55);
  } else if (dev.mode === 'squat') {
    dev.squats = Math.floor((dev.modeSec.squat || 0) / 6);
  }
  if (Math.random() < dt / 600) dev.fallArrests += 1; // occasional simulated fall arrest
}

function status() {
  tick();
  return {
    ok: true,
    connected: true,
    state: dev.state,
    mode: dev.mode,
    speed: dev.speed,
    offloading: dev.offloading,
    offloadUnit: dev.offloadUnit,
    liftPosition: Math.round(dev.liftPosition),
    battery: dev.battery,
    durationSec: Math.floor(dev.durationSec),
    steps: dev.steps,
    squats: dev.squats,
    fallArrests: dev.fallArrests,
    breaks: dev.breaks,
    distanceM: Math.round(dev.distanceM * 10) / 10,
    speedMps: Math.round(dev.speedMps * 100) / 100,
  };
}

function resetCounters() {
  Object.assign(dev, {
    durationSec: 0, steps: 0, squats: 0, fallArrests: 0, breaks: 0, distanceM: 0, speedMps: 0,
    modeSec: {}, walkSpeeds: [], pauseSec: 0, unloadKgSec: 0, maxKg: null, minKg: null,
  });
}

const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// The finished session, in the same shape the HTTP transport returns.
function summary() {
  const avg = dev.durationSec > 0 ? dev.unloadKgSec / dev.durationSec : unloadKg();
  return {
    durationSec: Math.floor(dev.durationSec), pauseSec: Math.floor(dev.pauseSec), breaks: dev.breaks, fallArrests: dev.fallArrests,
    steps: dev.steps, distanceM: r1(dev.distanceM), squats: dev.squats,
    balanceSec: Math.floor(dev.modeSec.balance || 0), walkingSec: Math.floor(dev.modeSec.walk || 0), squatSec: Math.floor(dev.modeSec.squat || 0),
    exercises: Object.entries(dev.modeSec).map(([mode, sec]) => ({ mode, sec: Math.floor(sec), speed: mode === 'walk' ? dev.walkSpeeds.map(cap).join(', ') : '' })),
    bodyWeightKg: dev.bodyWeight, avgUnloadKg: r1(avg), avgUnloadPct: avg != null && dev.bodyWeight ? r1((avg / dev.bodyWeight) * 100) : null,
    maxUnloadKg: r1(dev.maxKg), minUnloadKg: r1(dev.minKg),
  };
}

function command(p) {
  tick();
  switch (p.cmd) {
    case 'lift':
      if (dev.state === 'estop') throw new Error('E-stop active');
      dev.liftPosition = Math.min(100, Math.max(0, dev.liftPosition + (p.dir === 'up' ? 1 : p.dir === 'down' ? -1 : 0)));
      break;
    case 'move':
      if (dev.state === 'estop') throw new Error('E-stop active');
      break;
    case 'offload':
      // Same hard cap the RT controller must apply: never unload more than 60 kg.
      if (typeof p.kg === 'number' && p.kg > MAX_OFFLOAD_KG + 1e-6) throw new Error(`Offloading above ${MAX_OFFLOAD_KG} kg refused`);
      if (p.unit === 'kg' && typeof p.value === 'number' && p.value > MAX_OFFLOAD_KG + 1e-6) throw new Error(`Offloading above ${MAX_OFFLOAD_KG} kg refused`);
      if (p.unit) dev.offloadUnit = p.unit;
      if (typeof p.value === 'number') dev.offloading = p.value;
      break;
    case 'mode':
      dev.mode = p.mode;
      if (p.speed) dev.speed = p.speed;
      if (p.mode === 'walk' && !dev.walkSpeeds.includes(dev.speed)) dev.walkSpeeds.push(dev.speed);
      break;
    case 'session':
      if (dev.state === 'estop' && p.action !== 'stop') throw new Error('E-stop active');
      if (p.action === 'start') {
        const speeds = dev.mode === 'walk' ? [dev.speed] : [];
        resetCounters();
        dev.walkSpeeds = speeds;
        dev.state = 'running';
      }
      if (p.action === 'break') { dev.state = 'break'; dev.breaks += 1; }
      if (p.action === 'resume') dev.state = 'running';
      if (p.action === 'stop') {
        dev.state = 'idle';
        dev.lastSummary = summary();
        dev.sessionId = null;
        return { ok: true, state: dev.state, summary: dev.lastSummary };
      }
      break;
    case 'estop':
      if (p.action === 'release') {
        // never auto-resume: an interrupted session comes back paused
        if (dev.state === 'estop') {
          if (dev.preEstop === 'running') dev.breaks += 1; // same as the server: counts as a break
          dev.state = dev.preEstop === 'idle' ? 'idle' : 'break';
        }
      } else if (dev.state !== 'estop') {
        dev.preEstop = dev.state;
        dev.state = 'estop';
      }
      break;
    default:
      throw new Error(`Unknown command ${p.cmd}`);
  }
  return { ok: true, state: dev.state };
}

const nextId = (prefix, list) => `${prefix}-${String(list.length + 1).padStart(4, '0')}`;

export const crioMock = {
  async login(username, password) {
    await delay(250);
    const u = db.users.find((x) => x.username.toLowerCase() === String(username).trim().toLowerCase() && x.password === password);
    if (!u) throw new Error('Invalid username or password');
    const { password: _pw, ...user } = u;
    return user;
  },
  async listPatients(therapistId) {
    await delay();
    return therapistId ? db.patients.filter((p) => p.therapistId === therapistId) : db.patients;
  },
  async createPatient(patient) {
    await delay(200);
    const p = { ...patient, id: nextId('P', db.patients) };
    db.patients = [...db.patients, p];
    persist();
    return p;
  },
  async listSessions(patientId) {
    await delay();
    return db.sessions.filter((s) => s.patientId === patientId);
  },
  async getPatient(id) {
    await delay();
    const p = db.patients.find((x) => x.id === id);
    if (!p) throw new Error(`Patient ${id} not found`);
    return p;
  },
  async registerTherapist({ name, username, password, isAdmin = false }) {
    await delay(200);
    if (db.users.some((u) => u.username.toLowerCase() === String(username).toLowerCase())) throw new Error(`Username '${username}' already exists`);
    const u = { id: nextId('t', db.users), username, password, name, role: isAdmin ? 'admin' : 'therapist' };
    db.users = [...db.users, u];
    persist();
    const { password: _pw, ...user } = u;
    return user;
  },
  // Same rules as the server: a new session cannot be opened while one is in progress.
  async openSession({ patientId, bodyWeightKg }) {
    await delay(150);
    if (dev.state === 'running' || dev.state === 'break' || (dev.state === 'estop' && dev.preEstop !== 'idle')) {
      throw new Error('A session is still in progress. End it first');
    }
    if (!(bodyWeightKg > 0 && bodyWeightKg <= config.maxBodyWeightKg)) throw new Error(`Body weight must be 1-${config.maxBodyWeightKg} kg`);
    dev.sessionId = `S-${Date.now()}`;
    dev.patientId = patientId;
    dev.bodyWeight = bodyWeightKg;
    dev.mode = null;
    dev.offloadUnit = 'percent';
    dev.offloading = Math.min(config.offloading.default, (MAX_OFFLOAD_KG / bodyWeightKg) * 100);
    resetCounters();
    return dev.sessionId;
  },
  async listTherapists() {
    await delay();
    return db.users.filter((u) => u.role === 'therapist').map(({ password: _pw, ...u }) => u);
  },
  async assignPatient(therapistId, patientId) {
    await delay();
    db.patients = db.patients.map((p) => (p.id === patientId ? { ...p, therapistId } : p));
    persist();
    return { ok: true };
  },
  async command(payload) {
    await delay(20);
    return command(payload);
  },
  async status() {
    await delay(10);
    return status();
  },
  async saveSession(report) {
    await delay(250);
    const s = { ...report, ...(dev.lastSummary || {}), id: nextId('S', db.sessions) };
    dev.lastSummary = null;
    db.sessions = [...db.sessions, s];
    persist();
    return s;
  },
};
