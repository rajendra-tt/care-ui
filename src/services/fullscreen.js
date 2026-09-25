// Full-screen handling for the tablet.
//
// * Full screen is the default. Browsers only allow entering full screen from a user gesture,
//   so the app enters it on the first tap and re-enters it on the next tap whenever the browser
//   drops out of it (many Android browsers leave full screen when the on-screen keyboard opens).
// * Kiosk mode (config.kiosk, default): full screen is enforced. There is no "Exit full screen"
//   option, and until the app is full screen a "Tap to continue" gate covers it (FullscreenGate).
// * Without kiosk mode, "Exit full screen" in the header turns this off; the choice is remembered.
// * If the app was installed to the home screen (manifest display: "fullscreen"), it is already
//   full screen without the Fullscreen API and none of this is needed.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { kioskEnabled } from './kiosk';

const KEY = 'care-fullscreen'; // 'on' (default) | 'off'
const EVT = 'care-fullscreen-change';

const doc = () => (typeof document !== 'undefined' ? document : null);
// Fields made read-only for the in-app keyboard do not open the tablet keyboard, so they don't count.
const isEditable = (el) => !!el && !el.readOnly && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

export const isInstalledFullscreen = () =>
  typeof window !== 'undefined' && !!window.matchMedia &&
  (window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches);

export const isSupported = () => {
  const el = doc()?.documentElement;
  return !!el && !!(el.requestFullscreen || el.webkitRequestFullscreen);
};

export const isFullscreen = () => {
  const d = doc();
  return !!d && (!!(d.fullscreenElement || d.webkitFullscreenElement) || isInstalledFullscreen());
};

export function getPreference() {
  if (kioskEnabled()) return true;
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
function setPreference(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage blocked: session only */ }
  window.dispatchEvent(new Event(EVT));
}

export function enterFullscreen() {
  const el = doc()?.documentElement;
  if (!el || isFullscreen()) return;
  try {
    const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen?.();
    r?.catch?.(() => {}); // refused (no user gesture yet / not allowed): try again on the next tap
  } catch { /* unsupported */ }
}

export function exitFullscreen() {
  const d = doc();
  if (!d || !(d.fullscreenElement || d.webkitFullscreenElement)) return;
  try {
    const r = d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen?.();
    r?.catch?.(() => {});
  } catch { /* ignore */ }
}

// Header button: switch between full screen and a normal browser window.
export function toggleFullscreen() {
  if (isFullscreen()) {
    setPreference(false);
    exitFullscreen();
  } else {
    setPreference(true);
    enterFullscreen();
  }
}

// ---- React bindings ----
function subscribe(cb) {
  const d = doc();
  d?.addEventListener('fullscreenchange', cb);
  d?.addEventListener('webkitfullscreenchange', cb);
  window.addEventListener(EVT, cb);
  return () => {
    d?.removeEventListener('fullscreenchange', cb);
    d?.removeEventListener('webkitfullscreenchange', cb);
    window.removeEventListener(EVT, cb);
  };
}
const snapshot = () => `${isFullscreen() ? 1 : 0}${getPreference() ? 1 : 0}`;

export function useFullscreenState() {
  const s = useSyncExternalStore(subscribe, snapshot, () => '01');
  // An installed app is always full screen (display mode), so there is nothing to toggle there.
  return { active: s[0] === '1', preferred: s[1] === '1', supported: isSupported() && !isInstalledFullscreen() && !kioskEnabled() };
}

// Kiosk mode: true while the app should be covered by the "Tap to continue" gate, i.e. it is not
// full screen and the user is not typing (Android leaves full screen when the keyboard opens; the
// gate must not cover the field being typed in). A short delay lets the tap that ends typing
// re-enter full screen by itself, so that tap is not swallowed by the gate.
export function useFullscreenGate() {
  const s = useSyncExternalStore(subscribe, snapshot, () => '01');
  const [editing, setEditing] = useState(false);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const update = () => setEditing(isEditable(document.activeElement));
    const afterBlur = () => setTimeout(update, 0); // activeElement is updated after focusout
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', afterBlur);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', afterBlur);
    };
  }, []);
  const needed = kioskEnabled() && isSupported() && !isInstalledFullscreen() && s[0] !== '1' && !editing;
  useEffect(() => {
    if (!needed) { setShow(false); return undefined; }
    const t = setTimeout(() => setShow(true), 700);
    return () => clearTimeout(t);
  }, [needed]);
  return show;
}

// Installed once (in Stage): keeps the app full screen while the preference is on.
export function useAutoFullscreen() {
  useEffect(() => {
    const onTap = (e) => {
      if (!getPreference() || isFullscreen()) return;
      // Never on a tap into a text field (the keyboard is about to open) or while typing.
      if (isEditable(e.target) || isEditable(document.activeElement)) return;
      enterFullscreen();
    };
    // click (and keyup for hardware keyboards) count as user gestures in every browser
    document.addEventListener('click', onTap, true);
    document.addEventListener('keyup', onTap, true);
    return () => {
      document.removeEventListener('click', onTap, true);
      document.removeEventListener('keyup', onTap, true);
    };
  }, []);
}
