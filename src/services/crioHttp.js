// Transport for the LabVIEW Web Service hosted on the cRIO-9056.
// Endpoint contract: see docs/CRIO_API.md.
import { config } from './config';

const url = (path) => `${config.apiBase}${config.apiPrefix}${path}`;

async function request(method, path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.requestTimeoutMs);
  try {
    const res = await fetch(url(path), {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `${method} ${path} failed (${res.status})`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export const crioHttp = {
  login: (username, password) => request('POST', '/login', { username, password }).then((d) => d.user),

  listPatients: (therapistId) =>
    request('GET', `/patients${therapistId ? `?therapistId=${encodeURIComponent(therapistId)}` : ''}`).then((d) => d.patients),
  createPatient: (patient) => request('POST', '/patients', patient).then((d) => d.patient),
  listSessions: (patientId) => request('GET', `/patients/${encodeURIComponent(patientId)}/sessions`).then((d) => d.sessions),

  listTherapists: () => request('GET', '/therapists').then((d) => d.therapists),
  assignPatient: (therapistId, patientId) => request('POST', `/therapists/${encodeURIComponent(therapistId)}/patients`, { patientId }),

  // Real-time device commands: { cmd: 'lift' | 'move' | 'offload' | 'session' | 'estop', ... }
  command: (payload) => request('POST', '/command', payload),
  status: () => request('GET', '/status'),

  saveSession: (report) => request('POST', '/sessions', report).then((d) => d.session),
};
