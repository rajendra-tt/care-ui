// In-app on-screen keyboard (CARE_CONFIG.onScreenKeyboard, on by default).
//
// Tablet browsers leave full screen when a text field starts taking input: Android when its keyboard
// opens, iPad (every iPad browser uses WebKit) as soon as a real text field gets focus - even with no
// keyboard shown. So text fields are made read-only to the browser (readonly + inputmode="none"):
// the tablet sees nothing to type into, keeps full screen and never shows its keyboard or bar.
// This keyboard (drawn inside the 1280x800 canvas) types into the focused field instead, and a
// hardware keyboard is forwarded the same way. Numeric fields (inputMode "decimal") get a number pad.
import React, { useEffect, useRef, useState } from 'react';
import { config } from '../services/config';
import { colors, font } from '../theme/tokens';

export const KB_HEIGHT = 300;
export const keyboardEnabled = () => config.onScreenKeyboard !== false;

const TEXT_TYPES = new Set(['text', 'password', 'search', 'email', 'tel', 'url', 'number', '']);
const isTextField = (el) =>
  !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TEXT_TYPES.has((el.getAttribute('type') || '').toLowerCase())));

// ---- keep the tablet's own keyboard closed --------------------------------------------------
function suppress(el) {
  if (!isTextField(el)) return;
  const mode = el.getAttribute('inputmode');
  if (mode !== 'none') el.setAttribute('data-kb-mode', mode || 'text'); // decides letters or number pad
  if (mode === 'none' && el.readOnly) return;
  el.setAttribute('inputmode', 'none');
  el.readOnly = true; // nothing for the tablet to type into: no keyboard, no leaving full screen
  el.setAttribute('spellcheck', 'false'); // no red underlines on names
  el.setAttribute('autocomplete', 'off');
}

function useSuppressNativeKeyboard(on) {
  useEffect(() => {
    if (!on) return undefined;
    const root = document.getElementById('root') || document.body;
    root.querySelectorAll('input, textarea').forEach(suppress);
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') suppress(r.target);
        r.addedNodes?.forEach((n) => {
          if (n.nodeType !== 1) return;
          suppress(n);
          n.querySelectorAll?.('input, textarea').forEach(suppress);
        });
      }
    });
    obs.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['inputmode', 'readonly'] });
    return () => obs.disconnect();
  }, [on]);
}

// ---- the focused text field (inside the app) -------------------------------------------------
export function useFocusedField() {
  const on = keyboardEnabled();
  useSuppressNativeKeyboard(on);
  const [field, setField] = useState(null);
  useEffect(() => {
    if (!on) return undefined;
    const root = document.getElementById('root');
    const update = () => {
      const el = document.activeElement;
      const f = isTextField(el) && root?.contains(el) ? el : null;
      if (f) { try { f.setSelectionRange(f.value.length, f.value.length); } catch { /* no selection API */ } }
      setField(f);
    };
    // A hardware keyboard cannot type into a read-only field by itself: forward its keys.
    const onKey = (e) => {
      const el = document.activeElement;
      if (!isTextField(el) || !root?.contains(el) || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      if (e.key === 'Backspace') { e.preventDefault(); backspace(el); }
      // Enter in a single-line field is left alone: the field handles it (e.g. Sign In submits)
      else if (e.key === 'Enter' && e.isTrusted && el.tagName === 'TEXTAREA') { e.preventDefault(); insert(el, '\n'); }
      else if (e.key.length === 1) { e.preventDefault(); insert(el, e.key); }
    };
    document.addEventListener('keydown', onKey, true);
    const later = () => setTimeout(update, 0); // activeElement is updated after focusout
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', later);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', later);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [on]);
  return field;
}

// ---- typing into a React-controlled field ----------------------------------------------------
// Set the value through the native setter and fire "input", exactly like real typing, so the
// field's onChangeText runs and React state stays the source of truth.
function setValue(el, value, caret) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  try { el.setSelectionRange(caret, caret); } catch { /* type without selection */ }
}

function insert(el, text) {
  const v = el.value || '';
  const start = el.selectionStart ?? v.length;
  const end = el.selectionEnd ?? v.length;
  const next = v.slice(0, start) + text + v.slice(end);
  if (el.maxLength > 0 && next.length > el.maxLength) return;
  setValue(el, next, start + text.length);
}

function backspace(el) {
  const v = el.value || '';
  const start = el.selectionStart ?? v.length;
  const end = el.selectionEnd ?? v.length;
  if (start !== end) setValue(el, v.slice(0, start) + v.slice(end), start);
  else if (start > 0) setValue(el, v.slice(0, start - 1) + v.slice(start), start - 1);
}

function enter(el) {
  if (el.tagName === 'TEXTAREA') { insert(el, '\n'); return; }
  // Single-line field: behave like the Enter key (e.g. Sign In submits), then close the keyboard.
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
  el.blur?.();
}

// ---- layouts ----------------------------------------------------------------------------------
const LETTERS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '{bksp}'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '{enter}'],
  ['{shift}', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '{shift}'],
  ['{123}', '{space}', '-', '@', '{hide}'],
];
const SYMBOLS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '{bksp}'],
  ['/', ':', ';', '(', ')', '&', '"', "'", '?', '{enter}'],
  ['#', '%', '+', '=', '*', '_', '!', ',', '.', '$'],
  ['{abc}', '{space}', '-', '@', '{hide}'],
];
const NUMBERS = [
  ['1', '2', '3', '{bksp}'],
  ['4', '5', '6', '{enter}'],
  ['7', '8', '9', '{hide}'],
  ['.', '0', '/'],
];
const BACKSPACE = (
  <svg width="34" height="24" viewBox="0 0 34 24" aria-hidden="true" style={{ display: 'block', margin: 'auto' }}>
    <path d="M11 2h19a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H11L2 12z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M15 7.5l9 9M24 7.5l-9 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);
const LABEL = { '{bksp}': BACKSPACE, '{enter}': 'Enter', '{shift}': '⇧', '{space}': 'space', '{123}': '123', '{abc}': 'ABC', '{hide}': 'Done' };
const WIDE = { '{space}': 5.2, '{enter}': 1.7, '{bksp}': 1.4, '{shift}': 1.4, '{123}': 1.4, '{abc}': 1.4, '{hide}': 1.6 };

export function OnScreenKeyboard({ field }) {
  const [layer, setLayer] = useState('letters'); // letters | symbols
  const [shift, setShift] = useState(false);
  const repeat = useRef(null);
  useEffect(() => { setLayer('letters'); setShift(false); }, [field]);
  useEffect(() => () => clearInterval(repeat.current), []);
  if (!field) return null;

  const numeric = ['decimal', 'numeric', 'tel'].includes(field.getAttribute('data-kb-mode'));
  const rows = numeric ? NUMBERS : layer === 'symbols' ? SYMBOLS : LETTERS;

  const press = (k) => {
    if (k === '{bksp}') backspace(field);
    else if (k === '{enter}') enter(field);
    else if (k === '{shift}') setShift((s) => !s);
    else if (k === '{space}') insert(field, ' ');
    else if (k === '{123}') setLayer('symbols');
    else if (k === '{abc}') setLayer('letters');
    else if (k === '{hide}') field.blur();
    else {
      insert(field, shift ? k.toUpperCase() : k);
      if (shift) setShift(false); // one capital, like a phone keyboard
    }
  };
  const down = (k) => (e) => {
    e.preventDefault(); // keep focus (and the caret) in the text field
    press(k);
    if (k === '{bksp}') {
      clearInterval(repeat.current);
      const started = Date.now();
      repeat.current = setInterval(() => { if (Date.now() - started > 450) backspace(field); }, 70);
    }
  };
  const up = () => clearInterval(repeat.current);

  return (
    <div
      role="group"
      aria-label="On-screen keyboard"
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: KB_HEIGHT, zIndex: 900, boxSizing: 'border-box',
        background: '#DDE6D9', borderTop: `1px solid ${colors.line}`, padding: numeric ? '14px 330px' : '12px 18px',
        display: 'flex', flexDirection: 'column', gap: 9, userSelect: 'none', touchAction: 'manipulation',
      }}
    >
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 9, flex: 1, justifyContent: 'center' }}>
          {row.map((k, j) => {
            const special = k.startsWith('{');
            const label = special ? LABEL[k] : shift && !numeric ? k.toUpperCase() : k;
            const active = k === '{shift}' && shift;
            const dark = k === '{hide}' || k === '{enter}';
            return (
              <button
                key={`${k}${j}`}
                type="button"
                tabIndex={-1}
                aria-label={k === '{bksp}' ? 'Backspace' : k === '{space}' ? 'Space' : label}
                onPointerDown={down(k)}
                onPointerUp={up}
                onPointerLeave={up}
                onPointerCancel={up}
                style={{
                  flex: numeric ? 1 : WIDE[k] || 1, minWidth: 0, border: 0, borderRadius: 10, cursor: 'pointer',
                  background: dark ? colors.primary : active ? colors.mint : special ? '#C3D3BD' : '#fff',
                  color: dark ? '#fff' : colors.primaryDark,
                  fontFamily: font.family, fontSize: numeric ? 28 : special ? 20 : 26, fontWeight: special ? 600 : 500,
                  boxShadow: '0 2px 0 rgba(37,66,41,0.18)', padding: 0,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
