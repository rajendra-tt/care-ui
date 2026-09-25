// Transport for the CARE 2.0 API (LabVIEW Web Service on the cRIO-9056, or server/care_server.py).
// Endpoints and JSON formats: docs/CRIO_API.md ("System Workflow Software" sheet).
// Screens call the same functions as the simulator (crioMock.js); this file maps them to the API.
import { config } from './config';

const url = (path) => `${config.apiBase}${config.apiPrefix}${path}`;

async function request(method, path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.requestTimeoutMs);
  let res;
  try {
    res = await fetch(url(path), {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    });
  } catch (e) {
    const err = new Error(e.name === 'AbortError' ? 'The device did not answer in time' : 'Cannot reach the device');
    err.code = 'NETWORK';
    throw err;
  } finally {
    clearTimeout(timer);
  }
  let data = {};
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : {};
  } catch { /* not JSON */ }
  // Every response carries "status": "success" | "error"; errors also "code" and "message".
  if (!res.ok || data.status === 'error') {
    const noServer = res.status >= 500 && !data.status; // e.g. the dev proxy: API server not running
    const err = new Error(data.message || (noServer ? 'Cannot reach the CARE server. Is it running?' : `${method} ${path} failed (HTTP ${res.status})`));
    err.code = data.code || `HTTP_${res.status}`;
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---- mapping between the API (snake_case) and the objects the screens use ----
const n = (v) => (v === null || v === undefined || v === '' ? undefined : Number(v));

// Patient table columns (Name, Age, Gender, Therapist_ID). Other form fields are sent in
// "details" but the schema has no column for them, so the server does not store them.
const PATIENT_FIELDS = { fullName: 'name', age: 'age', gender: 'gender', therapistId: 'therapist_id' };

const toPatient = (p) => ({
  id: p.id,
  fullName: p.name,
  age: p.age,
  gender: p.gender,
  therapistId: p.therapist_id,
  addedDate: p.added_date,
  lastSessionDate: p.last_session_date,
});

function fromPatient(form) {
  const body = { details: {} };
  Object.entries(form).forEach(([k, v]) => {
    if (v === undefined || v === '') return;
    if (PATIENT_FIELDS[k]) body[PATIENT_FIELDS[k]] = v;
    else body.details[k] = v;
  });
  return body;
}

// Vitals come back as {bp, heart_rate, spo2, weight, notes}; the screens use hr.
const toVitals = (v) => (v ? { bp: v.bp, spo2: v.spo2, hr: v.heart_rate ?? v.hr, weight: v.weight, notes: v.notes } : undefined);

// A session from the API (history, report, end of session) -> the object the screens use.
const toSession = (s) => {
  const d = s.session_data || {};
  return {
    id: s.session_id,
    patientId: s.patient_id,
    therapistId: s.therapist_id,
    date: (s.date || '').slice(0, 10),
    mode: s.mode?.name || null,
    speed: s.mode?.speed ? s.mode.speed.toLowerCase() : null,
    offloading: n(s.unloading?.value),
    offloadUnit: s.unloading?.type === 'weight' ? 'kg' : 'percent',
    bodyWeightKg: n(s.body_weight_kg),
    durationSec: n(d.session_duration) || 0,
    breaks: n(d.break_count) || 0,
    steps: n(d.steps) || 0,
    squats: n(d.sit_stand_count) || 0,
    distanceM: n(d.distance_walked) || 0,
    fallArrests: n(d.fall_arrest_count) || 0,
    pauseSec: n(d.pause_time) || 0,
    balanceSec: n(d.balance_time) || 0,
    walkingSec: n(d.walking_time) || 0,
    squatSec: n(d.squat_time) || 0,
    exercises: (d.exercises || []).map((e) => ({ mode: e.mode, sec: n(e.time) || 0, speed: e.speed || '' })),
    avgUnloadKg: n(d.avg_unloading_kg),
    avgUnloadPct: n(d.avg_unloading_percentage),
    maxUnloadKg: n(d.max_unloading_kg),
    minUnloadKg: n(d.min_unloading_kg),
    vitalsBefore: toVitals(d.before),
    vitalsAfter: toVitals(d.after),
    comments: d.comments,
  };
};

// ---- the open session on the device ----
let sessionId = null; // from POST /sessions; re-learnt from /device/status after a page reload
let pendingMode = null; // { name, speed } chosen on the Select Mode screen, sent with Start / Resume
let lastUnloading = null; // { type, value } last set-point sent

const unloadingBody = (value, unit) => ({ type: unit === 'kg' ? 'weight' : 'percentage', value: String(value) });
const sid = () => (sessionId == null ? undefined : String(sessionId));
const withSession = (body) => ({ session_id: sid(), ...body });
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const MOVES = {
  lift: { up: 'patient_up', down: 'patient_down', stop: 'stop' },
  move: { front: 'device_forward', back: 'device_backward', left: 'device_left', right: 'device_right', stop: 'stop' },
};

// POST /device/estop is sent even without a session: a stop must never wait for anything.
async function command(p) {
  switch (p.cmd) {
    case 'lift':
    case 'move': {
      const movement = MOVES[p.cmd][p.dir];
      if (!movement) throw new Error(`Unknown direction ${p.dir}`);
      return request('POST', '/device/control', withSession({ movement: { command: movement } }));
    }
    case 'offload':
      lastUnloading = unloadingBody(p.value, p.unit);
      return request('POST', '/device/control', withSession({ unloading: lastUnloading }));
    case 'mode':
      pendingMode = { name: p.mode, ...(p.mode === 'walk' ? { speed: cap(p.speed || 'slow') } : {}) };
      return { status: 'success' }; // sent with Start / Resume (POST /sessions/mode, /sessions/resume)
    case 'session': {
      const extra = { ...(pendingMode ? { mode: pendingMode } : {}), ...(lastUnloading ? { unloading: lastUnloading } : {}) };
      if (p.action === 'start') return request('POST', '/sessions/mode', withSession(extra));
      if (p.action === 'break') return request('POST', '/sessions/break', withSession({ break: true }));
      if (p.action === 'resume') return request('POST', '/sessions/resume', withSession(extra));
      if (p.action === 'stop') {
        // The reply is the finished session: hand it to the report screen as `summary`.
        const d = await request('POST', '/sessions/end', withSession({}));
        return { ...d, summary: toSession(d) };
      }
      throw new Error(`Unknown session action ${p.action}`);
    }
    case 'estop':
      return request('POST', '/device/estop', withSession({ soft_brake: p.action !== 'release' }));
    default:
      throw new Error(`Unknown command ${p.cmd}`);
  }
}

export const crioHttp = {
  // login_status: 1 = therapist, 2 = admin (0 comes back as HTTP 401)
  login: (username, password) =>
    request('POST', '/auth/login', { username: String(username).trim(), password }).then((d) => ({
      id: d.therapist.id,
      name: d.therapist.name,
      username: d.therapist.username,
      role: d.login_status === 2 ? 'admin' : 'therapist',
    })),
  registerTherapist: ({ name, username, password, isAdmin = false }) =>
    request('POST', '/therapists/register', { username, password, is_admin: !!isAdmin, Name: name })
      .then((d) => ({ id: d.therapist_id, name, username, role: isAdmin ? 'admin' : 'therapist' })),

  listPatients: (therapistId) =>
    request('GET', `/patients${therapistId ? `?therapist_id=${encodeURIComponent(therapistId)}` : ''}`).then((d) => d.patients.map(toPatient)),
  getPatient: (id) => request('GET', `/patients/${encodeURIComponent(id)}`).then((d) => toPatient(d.patient)),
  createPatient: (patient) => request('POST', '/patients', fromPatient(patient)).then((d) => toPatient(d.patient)),
  listSessions: (patientId) => request('GET', `/patients/${encodeURIComponent(patientId)}/sessions`).then((d) => d.sessions.map(toSession)),

  listTherapists: () => request('GET', '/therapists').then((d) => d.therapists),
  assignPatient: (therapistId, patientId) =>
    request('POST', `/therapists/${encodeURIComponent(therapistId)}/patients`, { patient_id: patientId }),

  // Vitals -> "Start Session": opens a session on the device and returns its id.
  openSession: async ({ patientId, therapistId, bodyWeightKg, vitalsBefore = {} }) => {
    const d = await request('POST', '/sessions', {
      patient_id: patientId,
      therapist_id: therapistId,
      body_weight_kg: bodyWeightKg,
      before: { bp: vitalsBefore.bp, heart_rate: vitalsBefore.hr, spo2: vitalsBefore.spo2, weight: vitalsBefore.weight, notes: vitalsBefore.notes },
    });
    sessionId = d.session_id;
    pendingMode = null;
    lastUnloading = null;
    return d.session_id;
  },

  command,

  // GET /device/status -> flat telemetry object used by the screens
  status: async () => {
    const d = await request('GET', '/device/status');
    const dev = d.device || {};
    const s = d.session_data || {};
    if (d.session_id != null) sessionId = d.session_id;
    return {
      connected: true,
      sessionId: d.session_id ?? null,
      state: dev.state || 'idle',
      mode: dev.mode?.name || null,
      speed: dev.mode?.speed ? dev.mode.speed.toLowerCase() : 'slow',
      offloading: n(dev.unloading?.value) ?? config.offloading.default,
      offloadUnit: dev.unloading?.type === 'weight' ? 'kg' : 'percent',
      durationSec: n(s.session_duration) || 0,
      steps: n(s.steps) || 0,
      squats: n(s.sit_stand_count) || 0,
      fallArrests: n(s.fall_arrest_count) || 0,
      breaks: n(dev.break_count) || 0,
      distanceM: n(s.distance_walked) || 0,
      speedMps: n(s.session_duration) ? (n(s.distance_walked) || 0) / n(s.session_duration) : 0,
    };
  },

  // Session Report -> save post-session vitals and comments. The counters come from the device.
  saveSession: async (report) => {
    const id = report.sessionId ?? sessionId;
    if (id == null) throw new Error('No session to save');
    const v = report.vitalsAfter || {};
    const d = await request('POST', `/sessions/${encodeURIComponent(id)}/report`, {
      after: { bp: v.bp, heart_rate: v.hr, spo2: v.spo2 },
      comments: report.comments || '',
    });
    sessionId = null;
    return toSession(d);
  },
};
