// Full-screen handling for the tablet.
//
// * Full screen is the default. Browsers only allow entering full screen from a user gesture,
//   so the app enters it on the first tap and re-enters it on the next tap whenever the browser
//   drops out of it (many Android browsers leave full screen when the on-screen keyboard opens).
// * "Exit full screen" in the header turns this off; the choice is remembered on the tablet.
// * If the app was installed to the home screen (manifest display: "fullscreen"), it is already
//   full screen without the Fullscreen API and none of this is needed.
import { useEffect, useSyncExternalStore } from 'react';

const KEY = 'care-fullscreen'; // 'on' (default) | 'off'
const EVT = 'care-fullscreen-change';

const doc = () => (typeof document !== 'undefined' ? document : null);
const isEditable = (el) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

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
  return { active: s[0] === '1', preferred: s[1] === '1', supported: isSupported() && !isInstalledFullscreen() };
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
