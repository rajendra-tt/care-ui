import React from 'react';

// Inline SVG icons (no icon font / CDN, the cRIO network is usually offline).
// Stroke icons use `color`; solid glyphs use it as fill.
const P = {
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></>,
  userSolid: <g fill="currentColor" stroke="none"><circle cx="12" cy="7.5" r="4.5" /><path d="M3.5 21c0-4.8 3.8-7.5 8.5-7.5s8.5 2.7 8.5 7.5z" /></g>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17" cy="7" r="2.8" /><path d="M16.5 12.5c3 0 5 2 5 5" /></>,
  userPlus: <><circle cx="10" cy="8" r="4" /><path d="M3 21c0-4 3.1-6.5 7-6.5 1.6 0 3 .4 4.2 1.1" /><path d="M18 15v6M15 18h6" /></>,
  lock: <g fill="currentColor" stroke="none"><rect x="4.5" y="10.5" width="15" height="11" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5h-2V8a2 2 0 0 0-4 0v2.5z" /></g>,
  arrowRight: <path d="M3 12h17M14 6l6 6-6 6" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  home: <path d="M3.5 10.5L12 3.5l8.5 7V20a1 1 0 0 1-1 1H15v-6.5H9V21H4.5a1 1 0 0 1-1-1z" />,
  wifi: <><path d="M2 8.8a15 15 0 0 1 20 0M5 12.3a10.5 10.5 0 0 1 14 0M8.3 15.7a5.5 5.5 0 0 1 7.4 0" /><circle cx="12" cy="19.2" r="1.3" fill="currentColor" /></>,
  wifiOff: <><path d="M2 8.8a15 15 0 0 1 20 0M5 12.3a10.5 10.5 0 0 1 14 0M8.3 15.7a5.5 5.5 0 0 1 7.4 0" opacity=".35" /><path d="M3 3l18 18" /></>,
  alarm: <g fill="currentColor" stroke="none"><circle cx="12" cy="13" r="7.5" /><path d="M4.2 3.6l3 2.4-1.6 1.7-2.8-2.5zM19.8 3.6l-3 2.4 1.6 1.7 2.8-2.5z" /><path d="M11.2 9h1.6v4.4l2.9 1.7-.8 1.4-3.7-2.2z" fill="#fff" /></g>,
  balance: <g fill="currentColor" stroke="none"><circle cx="12" cy="4" r="2.4" /><path d="M8.2 8.2h7.6l1.4 5.3 3 1.4-.7 1.5-3.7-1.6-1.1-3.8v3.4l3.8 2.6H5.5l3.8-2.6v-3.4L8.2 14.8 4.5 16.4l-.7-1.5 3-1.4z" /><rect x="3" y="19.5" width="18" height="1.8" rx=".9" /></g>,
  squat: <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none"><circle cx="11.5" cy="4" r="2.2" fill="currentColor" stroke="none" /><path d="M10.5 7.5L8.5 13l7 .5-1 7" /><path d="M10 9.5l8 .5" /></g>,
  walk: <g fill="currentColor" stroke="none"><circle cx="13" cy="3.3" r="2.2" /><path d="M10.5 7l3.3-.3 2.2 3.6 3.2 1.3-.7 1.6-3.8-1.5-1.1-1.7-.9 4.1 2.6 2.6.9 5.9h-2l-.8-5-2.9-2.6-1.2 3.7-3.5 3.9-1.5-1.3 3.2-3.6 1.8-7.6-1.5.7-1.2 3.3-1.8-.6 1.5-4.3z" /></g>,
  stop: <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none" />,
  cup: <g fill="currentColor" stroke="none"><path d="M4 9h12v6.5A4.5 4.5 0 0 1 11.5 20h-3A4.5 4.5 0 0 1 4 15.5z" /><path d="M16 10.5h1.5a2.7 2.7 0 0 1 0 5.4H16v-1.8h1.5a.9.9 0 0 0 0-1.8H16z" /><path d="M8 3.5c-1 1 1 1.8 0 3M11.3 3.5c-1 1 1 1.8 0 3" stroke="currentColor" strokeWidth="1.2" fill="none" /></g>,
  heartPulse: <><path d="M12 20.5s-8.5-5-8.5-11A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 2.9c0 6-8.5 11-8.5 11z" /><path d="M6 12h3l1.5-2.5 2.2 5 1.5-2.5H18" /></>,
  drop: <><path d="M12 3s6.5 7 6.5 11.3a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z" /><path d="M8.5 14.5h1.8l1-1.8 1.5 3.4 1-1.6h1.7" /></>,
  history: <><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" /><path d="M3.5 4v4h4" /><path d="M12 7.5V12l3 2" /></>,
  check: <path d="M4.5 12.5l5 5 10-11" />,
  logout: <><path d="M14 4.5a8 8 0 1 0 0 15" /><path d="M10 12h11M17.5 8.5L21 12l-3.5 3.5" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.8-4.8" /></>,
  fall: <g fill="currentColor" stroke="none"><circle cx="17.5" cy="5" r="2.2" /><path d="M5 9.5l5.5-1.8 4.3 1.4 2.4 4.1-1.6.9-1.7-2.9-2.6-.6 1.7 3.4-1.8 5.5-1.8-.6 1.4-4.5-2.2-3.2-3.2 1z" /><path d="M3 21h8v1.6H3z" /></g>,
  steps: <g fill="currentColor" stroke="none"><ellipse cx="8" cy="8" rx="3" ry="4.8" /><rect x="5.6" y="13.6" width="4.8" height="3" rx="1.5" /><ellipse cx="16" cy="11" rx="3" ry="4.8" /><rect x="13.6" y="16.6" width="4.8" height="3" rx="1.5" /></g>,
  speed: <><path d="M4 17a8 8 0 1 1 16 0" /><path d="M12 17l4-5" /><circle cx="12" cy="17" r="1.3" fill="currentColor" /></>,
  distance: <g fill="currentColor" stroke="none"><circle cx="6.5" cy="15.5" r="3.2" /><circle cx="6.5" cy="15.5" r="1.2" fill="#fff" /><path d="M16.5 3a4 4 0 0 1 4 4c0 3-4 7-4 7s-4-4-4-7a4 4 0 0 1 4-4z" /><circle cx="16.5" cy="7" r="1.4" fill="#fff" /></g>,
  person: <g fill="currentColor" stroke="none"><path d="M4 18.5c0-3.5 3.6-6 8-6s8 2.5 8 6v1.5H4z" /><circle cx="12" cy="7" r="4" /></g>,
  endSession: <g fill="currentColor" stroke="none"><path d="M5 5l10 7-10 7z" /><rect x="16.5" y="5" width="2.5" height="14" rx=".8" /></g>,
  play: <path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none" />,
  calendar: <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  gender: <><circle cx="9.5" cy="14.5" r="4.5" /><path d="M13 11l7-7M15.5 4H20v4.5" /></>,
  height: <path d="M6 4h12M6 20h12M12 6v12M9.5 8.5L12 6l2.5 2.5M9.5 15.5L12 18l2.5-2.5" />,
  weight: <><path d="M12 4v16M6 20h12M4 7h16" /><path d="M6.5 7L3.5 14h6zM17.5 7l-3 7h6z" /></>,
  briefcase: <g fill="currentColor" stroke="none"><path d="M9 4h6a1.5 1.5 0 0 1 1.5 1.5V7H20a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5v-10A1.5 1.5 0 0 1 4 7h3.5V5.5A1.5 1.5 0 0 1 9 4zm0 1.7V7h6V5.7z" /></g>,
  pin: <g fill="currentColor" stroke="none"><path d="M12 2.5a7 7 0 0 1 7 7c0 5.2-7 12-7 12s-7-6.8-7-12a7 7 0 0 1 7-7z" /><circle cx="12" cy="9.5" r="2.6" fill="#fff" /></g>,
  idCard: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  stethoscope: <><path d="M6 3v6a4 4 0 0 0 8 0V3" /><path d="M10 13v2a5 5 0 0 0 10 0v-2" /><circle cx="20" cy="11" r="2" /></>,
  hourglass: <path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" />,
  clipboard: <><rect x="5" y="4.5" width="14" height="16.5" rx="2" /><path d="M9 3h6v3H9zM8.5 11h7M8.5 15h7" /></>,
  report: <><path d="M6 3h9l4 4v14H6z" /><path d="M14.5 3v4.5H19M9 12h6M9 16h6" /></>,
  device: <><rect x="4" y="6" width="16" height="11" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  save: <><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  eye: <><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M10.6 5.6c.5-.1.9-.1 1.4-.1 6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.1 3.9M6.5 7.1A16.6 16.6 0 0 0 2 12s3.6 6.5 10 6.5c1.9 0 3.5-.6 4.9-1.4" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="M3 3l18 18" /></>,
  fullscreen: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  exitFullscreen: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
};

export default function Icon({ name, size = 24, color = 'currentColor', strokeWidth = 1.8, style }) {
  const glyph = P[name];
  if (!glyph) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color, display: 'block', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
}

// Solid triangle used on the round jog / offloading buttons.
export function Triangle({ dir = 'up', size = 34, color }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', transform: `rotate(${rot}deg)` }} aria-hidden="true">
      <path d="M12 4.5L22 19H2z" fill={color} />
    </svg>
  );
}

export function Battery({ level, size = 26, color = '#fff' }) {
  const pct = typeof level === 'number' ? Math.max(0, Math.min(100, level)) : 100;
  const fill = pct < 20 ? '#FF6B6B' : color;
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true" style={{ display: 'block' }}>
      <rect x="2" y="7.5" width="19" height="11" rx="2.2" fill="none" stroke={color} strokeWidth="2" />
      <rect x="22" y="10.5" width="2.2" height="5" rx="1" fill={color} />
      <rect x="4" y="9.5" width={(15 * pct) / 100} height="7" rx="1" fill={fill} />
    </svg>
  );
}
