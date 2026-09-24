import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, RoundArrow, T } from './ui';
import { useApp } from '../state/AppState';
import { config } from '../services/config';
import {
  MAX_OFFLOAD_KG, atLimit, bodyWeightKg, clampTo, convert, fmt, maxFor, offloadKg, offloadPct, stepValue,
} from '../services/offloading';
import { colors, font } from '../theme/tokens';

// Jog commands are re-sent while held; the RT loop should treat silence as "stop".
function useJog(cmd) {
  const { sendCommand } = useApp();
  return (dir) => ({
    onTick: () => sendCommand({ cmd, dir }).catch(() => {}),
    onRelease: () => sendCommand({ cmd, dir: 'stop' }).catch(() => {}),
    interval: config.jogRepeatMs,
  });
}

export function LiftControl({ disabled, size = 64, compact, title = 'Patient Lift' }) {
  const jog = useJog('lift');
  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      {title ? <T style={styles.title}>{title}</T> : null}
      <View style={[styles.liftRow, compact && { gap: 90 }]}>
        <RoundArrow dir="up" label="Up" size={size} disabled={disabled} {...jog('up')} />
        <RoundArrow dir="down" label="Down" size={size} disabled={disabled} {...jog('down')} />
      </View>
    </View>
  );
}

export function MovementControl({ disabled, size = 58, title = 'Device Control' }) {
  const jog = useJog('move');
  return (
    <View style={{ alignItems: 'center', width: '100%' }}>
      {title ? <T style={styles.title}>{title}</T> : null}
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <RoundArrow dir="up" label="Front" size={size} disabled={disabled} {...jog('front')} />
        <View style={{ flexDirection: 'row', gap: size + 14, marginTop: -18 }}>
          <RoundArrow dir="left" label="Left" size={size} disabled={disabled} {...jog('left')} />
          <RoundArrow dir="right" label="Right" size={size} disabled={disabled} {...jog('right')} />
        </View>
        <View style={{ marginTop: -18 }}>
          <RoundArrow dir="down" label="Back" size={size} disabled={disabled} {...jog('back')} />
        </View>
      </View>
    </View>
  );
}

// Large D-pad used on the stand-alone Device Control screen.
export function MovementPad({ disabled, size = 104 }) {
  const jog = useJog('move');
  return (
    <View style={{ alignItems: 'center' }}>
      <RoundArrow dir="up" size={size} disabled={disabled} {...jog('front')} label="Front" />
      <View style={{ flexDirection: 'row', gap: size * 0.9, marginTop: -size * 0.22 }}>
        <RoundArrow dir="left" size={size} disabled={disabled} {...jog('left')} label="Left" />
        <RoundArrow dir="right" size={size} disabled={disabled} {...jog('right')} label="Right" />
      </View>
      <View style={{ marginTop: -size * 0.22 }}>
        <RoundArrow dir="down" size={size} disabled={disabled} {...jog('back')} label="Back" />
      </View>
    </View>
  );
}

export function LiftColumn({ disabled, size = 94 }) {
  const jog = useJog('lift');
  return (
    <View style={{ alignItems: 'center', gap: 90 }}>
      <RoundArrow dir="up" size={size} disabled={disabled} {...jog('up')} label="Up" />
      <RoundArrow dir="down" size={size} disabled={disabled} {...jog('down')} label="Down" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Minimal rotary knob around the offloading value. Drag the handle around the dial to set the value;
// the full 270 degree sweep is the patient's limit (max), so it can never be turned past 60 kg.
// Only the handle can be grabbed: a tap elsewhere on the ring does not jump the value.
const SWEEP = 270;
const START = 225; // degrees clockwise from 12 o'clock (bottom-left)

function Knob({ value, max, unit, size = 190, disabled, onChange }) {
  const pad = 16; // room for the handle outside the track
  const box = size + pad * 2;
  const c = box / 2;
  const r = size / 2 - 6; // track radius
  const frac = Math.max(0, Math.min(1, max ? value / max : 0));
  const svgRef = useRef(null);
  const drag = useRef(null);
  const [active, setActive] = useState(false);

  const pt = (deg, rad = r) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [c + rad * Math.cos(a), c + rad * Math.sin(a)];
  };
  const arc = (from, to, rad = r) => {
    const [x0, y0] = pt(from, rad);
    const [x1, y1] = pt(to, rad);
    return `M ${x0} ${y0} A ${rad} ${rad} 0 ${to - from > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const angle = START + SWEEP * frac;
  const [hx, hy] = pt(angle);

  // Pointer position in knob coordinates (the whole UI is CSS-scaled to fit the screen).
  const local = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const k = box / rect.width;
    return [(e.clientX - rect.left) * k, (e.clientY - rect.top) * k];
  };
  // Pointer position -> fraction of the sweep; the dead zone at the bottom snaps to the nearer end.
  const fracAt = (e) => {
    const [x, y] = local(e);
    const deg = ((Math.atan2(y - c, x - c) * 180) / Math.PI + 90 + 360) % 360;
    const rel = (deg - START + 360) % 360;
    if (rel <= SWEEP) return rel / SWEEP;
    return drag.current && drag.current.last > 0.5 ? 1 : 0;
  };

  const onPointerDown = (e) => {
    if (disabled || !max) return;
    const [x, y] = local(e);
    if (Math.hypot(x - hx, y - hy) > 30) return; // must grab the handle
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { last: frac };
    setActive(true);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const f = fracAt(e);
    if (Math.abs(f - drag.current.last) > 0.5) return; // ignore jumps across the dead zone
    drag.current.last = f;
    onChange(f * max, false);
  };
  const end = (e) => {
    if (!drag.current) return;
    drag.current = null;
    setActive(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    onChange(null, true);
  };

  const dec = !Number.isInteger(Math.round(value * 10) / 10);
  const handleColor = disabled ? '#B9C4B6' : colors.primary;

  return (
    <View style={{ width: box, height: box, margin: -pad, alignItems: 'center', justifyContent: 'center' }}>
      <svg
        ref={svgRef}
        width={box}
        height={box}
        style={{ position: 'absolute', left: 0, top: 0, touchAction: 'none', cursor: disabled ? 'default' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        role="slider"
        aria-label="Offloading knob"
        aria-valuemin={0}
        aria-valuemax={max ?? 0}
        aria-valuenow={Math.round(value * 100) / 100}
        aria-valuetext={`${fmt(value)} ${unit === 'kg' ? 'kg' : 'percent'}`}
        aria-disabled={disabled ? 'true' : 'false'}
      >
        {/* minimal: soft green disc behind the value, thin track, green progress arc, small solid handle */}
        <defs>
          <radialGradient id="knobDisc" cx="50%" cy="60%" r="55%">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#E3F0DD" />
          </radialGradient>
        </defs>
        <circle cx={c} cy={c} r={r - 10} fill="url(#knobDisc)" />
        <path d={arc(START, START + SWEEP)} stroke="#E8EDE6" strokeWidth="6" fill="none" strokeLinecap="round" />
        {frac > 0 ? <path d={arc(START, angle)} stroke={handleColor} strokeWidth="6" fill="none" strokeLinecap="round" /> : null}
        <circle cx={hx} cy={hy} r={active ? 12 : 10} fill={handleColor} stroke="#FFFFFF" strokeWidth="3" />
      </svg>
      <View style={{ alignItems: 'center', pointerEvents: 'none' }}>
        <T style={{ fontSize: size * (dec ? 0.22 : 0.27), fontWeight: '600', color: colors.primaryDark, lineHeight: size * 0.3 }}>{fmt(value, 1)}</T>
        <T style={{ fontSize: 16, fontWeight: '600', color: colors.grey }}>{unit === 'kg' ? 'kg' : '%'}</T>
      </View>
    </View>
  );
}

const KNOB_SEND_MS = 120;

export function OffloadingPanel({ disabled, style, gaugeSize = 190, arrowSize = 72 }) {
  const { telemetry, sendCommand, vitalsBefore, patient } = useApp();
  const weight = bodyWeightKg(vitalsBefore, patient);
  const unit = telemetry.offloadUnit === 'kg' ? 'kg' : 'percent';
  const max = maxFor(unit, weight); // null = % without a known body weight
  const [value, setValue] = useState(telemetry.offloading);
  const valueRef = useRef(value);
  const editing = useRef(false);

  const send = (v, u) =>
    sendCommand({ cmd: 'offload', value: v, unit: u, kg: offloadKg(v, u, weight), bodyWeightKg: weight }).catch(() => {});

  // follow the controller unless the user is actively adjusting
  useEffect(() => {
    if (!editing.current) { setValue(telemetry.offloading); valueRef.current = telemetry.offloading; }
  }, [telemetry.offloading]);

  // Limits move with the body weight: pull the set-point down if it is now above the limit.
  useEffect(() => {
    if (max != null && valueRef.current > max + 1e-9) {
      const v = clampTo(valueRef.current, unit, weight);
      valueRef.current = v;
      setValue(v);
      send(v, unit);
    }
  }, [max, unit, weight]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = (d) => {
    editing.current = true;
    const nv = stepValue(valueRef.current, d, unit, weight);
    if (nv === valueRef.current) return;
    valueRef.current = nv;
    setValue(nv);
    send(nv, unit);
  };
  const release = () => setTimeout(() => { editing.current = false; }, config.statusPollMs * 3);

  // Knob drag: snap to whole steps (the top of the sweep is exactly the limit), send at most
  // every KNOB_SEND_MS while turning, and always send the final value on release.
  const lastSend = useRef(0);
  const onKnob = (raw, done) => {
    if (done) {
      send(valueRef.current, unit);
      release();
      return;
    }
    editing.current = true;
    const { step: st } = config.offloading;
    let v = Math.round(raw / st) * st;
    if (max != null && raw >= max - st / 2) v = max;
    v = clampTo(v, unit, weight);
    if (v === valueRef.current) return;
    valueRef.current = v;
    setValue(v);
    const now = Date.now();
    if (now - lastSend.current >= KNOB_SEND_MS) {
      lastSend.current = now;
      send(v, unit);
    }
  };

  const setUnit = (u) => {
    if (u === unit || disabled) return;
    const nv = convert(valueRef.current, unit, u, weight);
    valueRef.current = nv;
    setValue(nv);
    send(nv, u);
  };

  const kg = offloadKg(value, unit, weight);
  const pct = offloadPct(value, unit, weight);
  const limited = atLimit(value, unit, weight);
  const noWeight = !weight;
  const lockPct = noWeight && unit === 'percent'; // cannot guarantee the 60 kg cap without a weight

  return (
    <Card style={[styles.offCard, style]}>
      <T style={styles.offTitle}>OFFLOADING</T>
      <T style={{ fontSize: 11, fontWeight: '700', marginTop: 4 }}>Mode</T>
      <View style={styles.toggle}>
        {[['percent', 'Percentage'], ['kg', 'Kg']].map(([u, l]) => (
          <Pressable key={u} onPress={() => setUnit(u)} style={[styles.toggleBtn, unit === u && styles.toggleOn]}>
            <T style={{ color: unit === u ? '#fff' : colors.grey, fontSize: font.small, fontWeight: '600' }}>{l}</T>
          </Pressable>
        ))}
      </View>
      <View style={styles.offBody}>
        <Knob value={value} max={max} unit={unit} size={gaugeSize} disabled={disabled || lockPct} onChange={onKnob} />
        <View style={{ gap: 26 }}>
          <RoundArrow dir="up" size={arrowSize} onTick={() => step(1)} onRelease={release} interval={110} initialDelay={450} disabled={disabled || lockPct || limited} label="" />
          <RoundArrow dir="down" size={arrowSize} onTick={() => step(-1)} onRelease={release} interval={110} initialDelay={450} disabled={disabled || lockPct || value <= config.offloading.min} label="" />
        </View>
      </View>

      {/* Live offloaded weight, recalculated from the body weight on every change */}
      <View style={[styles.strip, limited && styles.stripLimit]} accessibilityLiveRegion="polite">
        {noWeight ? (
          <T style={styles.stripNote}>Enter the body weight in Patient vitals to calculate the offloaded kg (max {MAX_OFFLOAD_KG} kg).</T>
        ) : (
          <>
            <View style={styles.stripRow}>
              <T style={styles.stripLabel}>Offloaded weight</T>
              <T style={styles.stripKg}>{fmt(kg, 1)} kg</T>
            </View>
            <T style={styles.stripSub}>{fmt(pct)} % of {fmt(weight, 1)} kg body weight</T>
            <T style={[styles.stripSub, limited && styles.stripWarn]}>
              {limited ? 'Limit reached · ' : ''}Max {fmt(maxFor('kg', weight), 1)} kg = {fmt(maxFor('percent', weight))} % of body weight
            </T>
          </>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.secondary, fontWeight: '600', marginBottom: 6 },
  liftRow: { flexDirection: 'row', gap: 110, marginTop: 6 },
  offCard: { alignItems: 'center', paddingTop: 16, paddingHorizontal: 20 },
  offTitle: { fontSize: 20, fontWeight: '600' },
  toggle: { flexDirection: 'row', alignSelf: 'stretch', backgroundColor: '#EEF2F5', borderRadius: 999, padding: 4, marginTop: 6, boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08)' },
  toggleBtn: { flex: 1, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  toggleOn: { backgroundColor: colors.primarySoft, boxShadow: '0 2px 5px rgba(0,0,0,0.15)' },
  offBody: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', paddingHorizontal: 4 },
  strip: { alignSelf: 'stretch', marginHorizontal: -20, marginBottom: 0, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: '#F1F7EE', borderTopWidth: 1, borderTopColor: colors.line, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, gap: 2 },
  stripLimit: { backgroundColor: '#FDF1E8', borderTopColor: '#F3C9AE' },
  stripRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  stripLabel: { fontSize: font.small, color: colors.textMuted, fontWeight: '600' },
  stripKg: { fontSize: 22, fontWeight: '700', color: colors.primaryDark },
  stripSub: { fontSize: 12, color: colors.textMuted },
  stripWarn: { color: '#B4531A', fontWeight: '700' },
  stripNote: { fontSize: 12.5, color: '#B4531A', fontWeight: '600', textAlign: 'center', paddingVertical: 6 },
});
