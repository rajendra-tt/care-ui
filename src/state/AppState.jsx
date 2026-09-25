import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { config } from '../services/config';

const AppContext = createContext(null);
const SESSION_SCREENS = ['DeviceControl', 'Session'];
export const useApp = () => useContext(AppContext);

const EMPTY_TELEMETRY = {
  state: 'idle',
  mode: null,
  speed: 'slow',
  offloading: config.offloading.default,
  offloadUnit: 'percent',
  battery: null,
  durationSec: 0,
  steps: 0,
  squats: 0,
  fallArrests: 0,
  breaks: 0,
  distanceM: 0,
  speedMps: 0,
};

export function AppProvider({ children }) {
  // --- navigation: a minimal stack, the way React Navigation would behave ---
  const [stack, setStack] = useState([{ name: 'Login', params: {} }]);
  const route = stack[stack.length - 1];
  const navigate = useCallback((name, params = {}) => setStack((s) => [...s, { name, params }]), []);
  const replace = useCallback((name, params = {}) => setStack((s) => [...s.slice(0, -1), { name, params }]), []);
  const goBack = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const reset = useCallback((name, params = {}) => setStack([{ name, params }]), []);

  // --- session data ---
  const [user, setUser] = useState(null);
  const [patient, setPatient] = useState(null);
  const [vitalsBefore, setVitalsBefore] = useState(null);

  // --- live telemetry from the cRIO ---
  const [telemetry, setTelemetry] = useState(EMPTY_TELEMETRY);
  const [connected, setConnected] = useState(true);
  const [everConnected, setEverConnected] = useState(false);
  const failures = useRef(0);

  // GET /device/status is polled only during a session: on the Device Control and Session screens
  // (both reached after Vitals opened the session). Elsewhere nothing is polled.
  const polling = !!user && SESSION_SCREENS.includes(route.name);

  useEffect(() => {
    if (!polling) return undefined;
    let alive = true;
    let timer;
    const poll = async () => {
      try {
        const s = await api.status();
        if (!alive) return;
        failures.current = 0;
        setConnected(true);
        setEverConnected(true);
        // only re-render when something actually changed (the RT target and tablet are both low-power)
        setTelemetry((t) => (Object.keys(s).some((k) => t[k] !== s[k]) ? { ...t, ...s } : t));
      } catch {
        failures.current += 1;
        if (failures.current >= 3 && alive) setConnected(false);
      } finally {
        if (alive) timer = setTimeout(poll, config.statusPollMs);
      }
    };
    poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [polling]);

  const sendCommand = useCallback(async (payload) => {
    try {
      const res = await api.command(payload);
      setConnected(true);
      // The server answers E-stop / break / resume / start with the new device state.
      if (res && typeof res.state === 'string') setTelemetry((t) => (t.state === res.state ? t : { ...t, state: res.state }));
      // optimistic merge so the UI reacts before the next poll
      if (payload.cmd === 'offload') {
        setTelemetry((t) => ({
          ...t,
          ...(typeof payload.value === 'number' ? { offloading: payload.value } : {}),
          ...(payload.unit ? { offloadUnit: payload.unit } : {}),
        }));
      }
      if (payload.cmd === 'mode') setTelemetry((t) => ({ ...t, mode: payload.mode, speed: payload.speed || t.speed }));
      return res;
    } catch (e) {
      if (e.code === 'NETWORK') setConnected(false);
      console.warn('[cRIO] command failed', payload, e);
      throw e;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setPatient(null);
    setVitalsBefore(null);
    setTelemetry(EMPTY_TELEMETRY);
    setConnected(true);
    setEverConnected(false);
    reset('Login');
  }, [reset]);

  const value = useMemo(
    () => ({
      route, navigate, replace, goBack, reset, canGoBack: stack.length > 1,
      user, setUser, logout,
      patient, setPatient,
      vitalsBefore, setVitalsBefore,
      telemetry, connected, everConnected, sendCommand,
    }),
    [route, navigate, replace, goBack, reset, stack.length, user, logout, patient, vitalsBefore, telemetry, connected, everConnected, sendCommand],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
