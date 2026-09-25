// Kiosk mode (CARE_CONFIG.kiosk, on by default): stops the tablet user from reaching browser
// features from inside the page. Turn it off in config.js while developing.
//
// A web page cannot hide the browser's address bar or stop the user from leaving full screen
// (Esc, back gesture, swipe) - that needs the device's kiosk mode. What the page can do is done here:
//   * no right-click / long-press menu, no dragging images or links
//   * F12, Ctrl+Shift+I/J/C/K (developer tools), Ctrl+U (view source), Ctrl+S / Ctrl+P blocked
//   * F5 / Ctrl+R (reload) blocked: a reload drops full screen and the screen the user is on
//   * browser zoom (Ctrl + / - / 0, Ctrl + mouse wheel) blocked
//   * the Back button / back gesture stays inside the app instead of leaving it
// Full screen itself is enforced by the full-screen gate (fullscreen.js, FullscreenGate).
import { config } from './config';

export const kioskEnabled = () => config.kiosk !== false;

const BLOCKED_KEYS = [
  (e) => e.key === 'F12',
  (e) => e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 'k'].includes(e.key.toLowerCase()), // dev tools
  (e) => e.metaKey && e.altKey && ['i', 'j', 'c', 'u'].includes(e.key.toLowerCase()), // dev tools (Mac)
  (e) => (e.ctrlKey || e.metaKey) && ['u', 's', 'p', 'r'].includes(e.key.toLowerCase()), // source, save, print, reload
  (e) => e.key === 'F5',
  (e) => (e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key), // zoom
];

// Close button (login screen). Browsers only let a page close a tab that a script opened, so
// window.close() is usually ignored (and never works in an installed home-screen app). In that case
// the app is replaced by closed.html, a plain page with a "Reopen CARE 2.0" button.
export function closeApp() {
  try { if (document.fullscreenElement) document.exitFullscreen?.(); else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.(); } catch { /* ignore */ }
  try { window.close(); } catch { /* not allowed */ }
  setTimeout(() => { if (!window.closed) window.location.replace('./closed.html'); }, 300);
}

export function installKiosk() {
  if (!kioskEnabled() || typeof window === 'undefined') return;
  const block = (e) => { e.preventDefault(); e.stopPropagation(); };

  window.addEventListener('contextmenu', block, true);
  window.addEventListener('dragstart', block, true);
  window.addEventListener('keydown', (e) => { if (BLOCKED_KEYS.some((test) => test(e))) block(e); }, true);
  window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false, capture: true });

  // Back button / gesture: keep an extra history entry and put it back whenever it is used.
  try {
    history.pushState({ care: true }, '', location.href);
    window.addEventListener('popstate', () => history.pushState({ care: true }, '', location.href));
  } catch { /* history unavailable */ }

  // No long-press callout (iOS/Android) on images and links.
  const css = document.createElement('style');
  css.textContent = '*{-webkit-touch-callout:none}';
  document.head.appendChild(css);
}
