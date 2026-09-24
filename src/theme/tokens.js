// Design tokens from "P007 - User Interface Asset Details CARE 2.0" (04 Sep 2026).
export const SCREEN = { width: 1280, height: 800, headerHeight: 73 };

export const colors = {
  primaryDark: '#254229', // header, confirm buttons, headings
  primary: '#639850', // pill buttons, arrows, accents
  primarySoft: '#A7C99D', // percentage toggle
  mint: '#E0EDE0', // add-new-patient pill, selected mode
  mintLight: '#EDF2E9', // screen background
  iconBg: '#E6EFE3',
  white: '#FFFFFF',
  grey: '#898989',
  greyLight: '#C9CFC7',
  line: '#D6E3D2',
  text: '#254229',
  textMuted: '#7C8A7E',
  danger: '#FF0000', // emergency stop
  dangerSoft: '#E04444', // cancel / log out
  breakBrown: '#C14F12', // break button
  resumeOrange: '#ED6C2A', // resume session
  selectedMode: '#D4EDC9',
};

export const font = {
  family: '"Open Sans", system-ui, sans-serif',
  headline: 35,
  primary: 24,
  secondary: 18,
  body: 16,
  small: 14,
  tiny: 12,
};

export const radius = { card: 18, tile: 14, modal: 28, button: 9, pill: 999 };

export const shadow = {
  card: { boxShadow: '0 4px 14px rgba(37, 66, 41, 0.10)' },
  button: { boxShadow: '0 3px 8px rgba(37, 66, 41, 0.18)' },
  modal: { boxShadow: '0 16px 40px rgba(0, 0, 0, 0.22)' },
};
