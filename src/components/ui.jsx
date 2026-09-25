import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon, { Triangle } from './Icon';
import { colors, font, radius, shadow } from '../theme/tokens';

export const T = ({ style, ...p }) => <Text {...p} style={[styles.text, style]} />;

// ---------------------------------------------------------------------------
// Pill button — every variant from the P007 asset sheet.
// ---------------------------------------------------------------------------
const PILL = {
  white: { bg: colors.white, fg: colors.primary, shadow: true },
  green: { bg: colors.primary, fg: colors.white, shadow: true },
  dark: { bg: colors.primaryDark, fg: colors.white, shadow: true },
  mint: { bg: colors.mint, fg: colors.primary },
  break: { bg: colors.breakBrown, fg: colors.white, shadow: true },
  resume: { bg: colors.resumeOrange, fg: colors.white, shadow: true },
  logout: { bg: colors.dangerSoft, fg: colors.white },
  outlineGreen: { bg: colors.white, fg: colors.primary, border: colors.primary, shadow: true },
  cancel: { bg: colors.white, fg: '#D62828', border: '#E57373', square: true },
  confirm: { bg: colors.primaryDark, fg: colors.white, square: true },
  deviceOrange: { bg: colors.resumeOrange, fg: colors.white, square: true },
};

export function PillButton({ label, variant = 'white', icon, iconRight, onPress, width, height = 53, fontSize = font.secondary, disabled, style, textStyle }) {
  const v = PILL[variant];
  // The label is centred on the whole button; icons are pinned to the edges. The same space is
  // kept free on both sides so the label never shifts, and the button widens if a label needs it.
  const iconSize = fontSize + 4;
  const side = icon || iconRight ? ICON_EDGE + iconSize + 8 : 22;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.pill,
        {
          minWidth: width,
          height,
          paddingHorizontal: side,
          backgroundColor: v.bg,
          borderRadius: v.square ? radius.button : radius.pill,
          borderWidth: v.border ? 1.5 : 0,
          borderColor: v.border,
          opacity: disabled ? 0.45 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        v.shadow && !disabled && shadow.button,
        hovered && !disabled && { filter: 'brightness(1.04)' },
        style,
      ]}
    >
      {icon ? <View style={[styles.pillIcon, { left: ICON_EDGE }]}><Icon name={icon} size={iconSize} color={v.fg} strokeWidth={2} /></View> : null}
      <T numberOfLines={1} style={[styles.pillText, opticalCenter(fontSize), { color: v.fg, fontSize }, textStyle]}>{label}</T>
      {iconRight ? <View style={[styles.pillIcon, { right: ICON_EDGE }]}><Icon name={iconRight} size={iconSize - 2} color={v.fg} strokeWidth={2} /></View> : null}
    </Pressable>
  );
}

const ICON_EDGE = 18;

// Open Sans sits about 3 % of its size low in its line box; lift it so capitals are optically centred.
export const opticalCenter = (fontSize) => ({ position: 'relative', top: -Math.round(fontSize * 0.03) });

export const BackButton = ({ onPress, label = 'Back', ...p }) => (
  <PillButton label={label} icon="chevronLeft" variant="white" width={178} height={53} onPress={onPress} {...p} />
);

export const NextButton = ({ label = 'Next', onPress, ...p }) => (
  <PillButton label={label} iconRight="chevronRight" variant="green" width={195} height={53} onPress={onPress} {...p} />
);

// ---------------------------------------------------------------------------
export const Card = ({ style, children, ...p }) => (
  <View {...p} style={[styles.card, style]}>
    {children}
  </View>
);

export function IconCircle({ name, size = 56, iconSize, color = colors.primary, bg = colors.iconBg, style }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Icon name={name} size={iconSize || size * 0.5} color={color} />
    </View>
  );
}

export function Avatar({ size = 114, color = '#B7D3C1', ring = true, style }) {
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, ring && shadow.card, style]}>
      <View style={{ marginTop: size * 0.2 }}>
        <Icon name="userSolid" size={size * 0.72} color={color} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Press-and-hold helper. `onTick` fires on press and then repeatedly while held;
// `onRelease` fires once when the finger lifts (or the pointer leaves).
// ---------------------------------------------------------------------------
export function useHold(onTick, { interval = 150, initialDelay = 0, onRelease } = {}) {
  const timers = useRef({});
  const held = useRef(false);
  const tickRef = useRef(onTick);
  const releaseRef = useRef(onRelease);
  tickRef.current = onTick;
  releaseRef.current = onRelease;

  const stop = useCallback(() => {
    clearTimeout(timers.current.t);
    clearInterval(timers.current.i);
    if (held.current) {
      held.current = false;
      releaseRef.current?.();
    }
  }, []);

  const start = useCallback(() => {
    stop();
    held.current = true;
    tickRef.current?.();
    timers.current.t = setTimeout(() => {
      timers.current.i = setInterval(() => tickRef.current?.(), interval);
    }, initialDelay || interval);
  }, [interval, initialDelay, stop]);

  useEffect(() => stop, [stop]);
  return { onPressIn: start, onPressOut: stop };
}

export function RoundArrow({ dir, size = 76, onTick, onRelease, interval, initialDelay, disabled, label, arrowColor = colors.primary }) {
  const hold = useHold(onTick, { interval, initialDelay, onRelease });
  const [active, setActive] = useState(false);
  return (
    <View style={{ alignItems: 'center' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label || dir}
        disabled={disabled}
        // no press-in delay: a quick tap must still produce exactly one step / jog pulse
        delayPressIn={0}
        delayPressOut={0}
        onPressIn={() => { setActive(true); hold.onPressIn(); }}
        onPressOut={() => { setActive(false); hold.onPressOut(); }}
        style={[
          styles.round,
          { width: size, height: size, borderRadius: size / 2, opacity: disabled ? 0.45 : 1 },
          active ? { backgroundColor: colors.mint, transform: [{ scale: 0.95 }] } : shadow.button,
        ]}
      >
        <Triangle dir={dir} size={size * 0.46} color={arrowColor} />
      </Pressable>
      {label ? <T style={styles.arrowLabel}>{label}</T> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------
export function UnderlineInput({ icon, style, right, ...p }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[styles.underline, { borderBottomColor: focus ? colors.primaryDark : colors.primary }, style]}>
      {icon ? <Icon name={icon} size={18} color="#8C9690" /> : null}
      <TextInput
        placeholderTextColor="#9AA39D"
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={styles.underlineInput}
        {...p}
      />
      {right}
    </View>
  );
}

export function BoxInput({ style, inputStyle, multiline, inputRef, ...p }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[styles.box, focus && { borderColor: colors.primary }, style]}>
      <TextInput
        ref={inputRef}
        placeholderTextColor="#A5ADA7"
        multiline={multiline}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={[styles.boxInput, multiline && { height: '100%', textAlignVertical: 'top' }, inputStyle]}
        {...p}
      />
    </View>
  );
}

// Blood pressure: two number fields with a fixed "/" between them (systolic / diastolic).
// The value is one string, "120/80". Both fields use the number pad; after 3 digits (or "/")
// the cursor moves to the diastolic field by itself.
export function BpInput({ value, onChange, boxWidth = 120, height = 54, invalid, style, showUnit = true }) {
  const [sys = '', dia = ''] = String(value || '').split('/');
  const diaRef = useRef(null);
  const emit = (s, d) => onChange(s || d ? `${s}/${d}` : '');
  const border = invalid ? { borderColor: '#E57373' } : null;
  const input = { textAlign: 'center', paddingHorizontal: 6, fontSize: font.secondary, fontWeight: '600' };
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: boxWidth < 80 ? 5 : 10 }, style]}>
      <BoxInput
        style={[{ width: boxWidth, height }, border]}
        inputStyle={input}
        placeholder="120"
        inputMode="numeric"
        accessibilityLabel="Systolic"
        value={sys}
        onChangeText={(t) => {
          const digits = t.replace(/\D/g, '').slice(0, 3);
          emit(digits, dia);
          if (t.includes('/') || digits.length === 3) diaRef.current?.focus();
        }}
      />
      <T style={{ fontSize: boxWidth < 80 ? 22 : 30, fontWeight: '600', color: colors.primaryDark }}>/</T>
      <BoxInput
        inputRef={diaRef}
        style={[{ width: boxWidth, height }, border]}
        inputStyle={input}
        placeholder="80"
        inputMode="numeric"
        accessibilityLabel="Diastolic"
        value={dia}
        onChangeText={(t) => emit(sys, t.replace(/\D/g, '').slice(0, 3))}
      />
      {showUnit ? <T style={{ fontSize: font.tiny, color: colors.grey }}>mmHg</T> : null}
    </View>
  );
}

// "120/80" -> error text, or undefined when valid (systolic 50-260, diastolic 30-160, sys > dia).
export function bpError(value) {
  const m = /^(\d{2,3})\/(\d{2,3})$/.exec(String(value || ''));
  if (!m) return value ? 'Enter both values' : 'Required';
  const [s, d] = [Number(m[1]), Number(m[2])];
  if (s < 50 || s > 260 || d < 30 || d > 160 || s <= d) return 'Check values';
  return undefined;
}

// ---------------------------------------------------------------------------
// Confirmation pop-up (602 x ~367 in the asset sheet).
// ---------------------------------------------------------------------------
export function ConfirmModal({
  visible, icon = 'check', iconBg = colors.iconBg, iconColor = colors.primary, title, subtitle, rows = [], children,
  cancelLabel = 'Cancel', confirmLabel = 'Confirm', onCancel, onConfirm, confirmVariant = 'confirm', cancelVariant = 'cancel',
  confirmIcon = 'check', busy, confirmDisabled, hideCancel,
}) {
  if (!visible) return null;
  return (
    <View style={styles.backdrop}>
      <View style={[styles.modal, shadow.modal]}>
        <IconCircle name={icon} size={56} iconSize={28} bg={iconBg} color={iconColor} />
        <T style={styles.modalTitle}>{title}</T>
        {subtitle ? <T style={styles.modalSub}>{subtitle}</T> : null}
        <View style={styles.modalBody}>
          {rows.map(([k, v]) => (
            <View key={k} style={styles.modalRow}>
              <T style={styles.modalKey}>{k}:</T>
              <T style={styles.modalVal}>{v}</T>
            </View>
          ))}
          {children}
        </View>
        <View style={styles.modalDivider} />
        <View style={styles.modalActions}>
          {hideCancel ? null : <PillButton label={cancelLabel} variant={cancelVariant} width={237} height={59} onPress={onCancel} disabled={busy} />}
          <PillButton label={confirmLabel} icon={confirmIcon} variant={confirmVariant} width={237} height={59} onPress={onConfirm} disabled={busy || confirmDisabled} />
        </View>
      </View>
    </View>
  );
}

// Session statistic tile (257x220 / 178x177 in the asset sheet).
export function StatTile({ icon, label, value, width = 178, height = 160, big }) {
  return (
    <Card style={{ width, height, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
      <IconCircle name={icon} size={big ? 58 : 46} iconSize={big ? 28 : 22} />
      <T style={{ fontSize: font.small, color: colors.textMuted, marginTop: 10, textAlign: 'center' }}>{label}</T>
      <T style={{ fontSize: big ? 30 : 24, fontWeight: '700', color: colors.primaryDark, marginTop: 4 }}>{value}</T>
    </Card>
  );
}

const styles = StyleSheet.create({
  text: { fontFamily: font.family, color: colors.text },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  pillIcon: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  pillText: { fontWeight: '600', textAlign: 'center' },
  card: { backgroundColor: colors.white, borderRadius: radius.card, ...shadow.card },
  round: { backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  arrowLabel: { fontSize: font.small, color: colors.textMuted, marginTop: 4 },
  underline: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1.5, paddingBottom: 6 },
  underlineInput: { flex: 1, fontFamily: font.family, fontSize: font.body, color: colors.text, paddingVertical: 4, outlineStyle: 'none' },
  box: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: colors.white, justifyContent: 'center' },
  boxInput: { fontFamily: font.family, fontSize: font.body, color: colors.text, paddingHorizontal: 14, paddingVertical: 10, outlineStyle: 'none' },
  backdrop: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(237,242,233,0.45)', backdropFilter: 'blur(3px)', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  // NOTE: SessionScreen draws the E-stop at zIndex 60, above this backdrop.
  modal: { width: 602, minHeight: 367, backgroundColor: colors.white, borderRadius: radius.modal, alignItems: 'center', paddingTop: 26, paddingBottom: 24, paddingHorizontal: 36 },
  modalTitle: { fontSize: 25, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  modalSub: { fontSize: 13, color: colors.grey, marginTop: 4, textAlign: 'center' },
  modalBody: { alignSelf: 'stretch', marginTop: 18, gap: 8, minHeight: 56 },
  modalRow: { flexDirection: 'row', gap: 8 },
  modalKey: { fontSize: font.body, color: colors.text },
  modalVal: { fontSize: font.body, color: colors.text, fontWeight: '700' },
  modalDivider: { alignSelf: 'stretch', height: 1, backgroundColor: '#CFCFCF', marginTop: 14, marginBottom: 22 },
  modalActions: { flexDirection: 'row', gap: 34 },
});
