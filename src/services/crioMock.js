// In-browser simulator of the cRIO controller, used when CARE_CONFIG.mode === 'mock'.
// Mirrors the HTTP contract in docs/CRIO_API.md so screens never know the difference.
import { config } from './config';
import { MAX_OFFLOAD_KG } from './offloading';

const STORE_KEY = 'care-mock-db-v1';
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
    { id: 'S-1001', patientId: 'P-0001', therapistId: 't-1', date: '2026-09-18', durationSec: 1260, mode: 'walk', breaks: 1, steps: 412, squats: 0 },
    { id: 'S-1002', patientId: 'P-0001', therapistId: 't-1', date: '2026-09-21', durationSec: 900, mode: 'balance', breaks: 0, steps: 0, squats: 0 },
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
  lastTick: Date.now(),
};
const SPEEDS = { slow: 0.35, medium: 0.6, fast: 0.9 };

function tick() {
  const now = Date.now();
  const dt = (now - dev.lastTick) / 1000;
  dev.lastTick = now;
  if (dev.state !== 'running') { dev.speedMps = 0; return; }
  dev.durationSec += dt;
  if (dev.mode === 'walk') {
    dev.speedMps = SPEEDS[dev.speed] * (0.9 + Math.random() * 0.2);
    dev.distanceM += dev.speedMps * dt;
    dev.steps = Math.floor(dev.distanceM / 0.55);
  } else if (dev.mode === 'squat') {
    dev.squats = Math.floor(dev.durationSec / 6);
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
  Object.assign(dev, { durationSec: 0, steps: 0, squats: 0, fallArrests: 0, breaks: 0, distanceM: 0, speedMps: 0 });
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
      break;
    case 'session':
      if (dev.state === 'estop' && p.action !== 'stop') throw new Error('E-stop active');
      if (p.action === 'start') { resetCounters(); dev.state = 'running'; }
      if (p.action === 'break') { dev.state = 'break'; dev.breaks += 1; }
      if (p.action === 'resume') dev.state = 'running';
      if (p.action === 'stop') dev.state = 'idle';
      break;
    case 'estop':
      if (p.action === 'release') {
        // never auto-resume: an interrupted session comes back paused
        if (dev.state === 'estop') dev.state = dev.preEstop === 'idle' ? 'idle' : 'break';
      } else if (dev.state !== 'estop') {
        dev.preEstop = dev.state;
        dev.state = 'estop';
      }
      break;
    default:
      throw new Error(`Unknown command ${p.cmd}`);
  }
  return { ok: true };
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
    const s = { ...report, id: nextId('S', db.sessions) };
    db.sessions = [...db.sessions, s];
    persist();
    return s;
  },
};
