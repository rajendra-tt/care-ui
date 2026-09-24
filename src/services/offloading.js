// Offloading maths shared by the offloading panel, session screen, pop-ups and report.
//
// The percentage is always a percentage of the patient's actual body weight (entered in the
// pre-session vitals). Unloading is capped at MAX_OFFLOAD_KG (60 kg) whatever the unit, so the
// percentage limit follows the body weight exactly:
//   max % = 60 kg / body weight x 100      e.g. 72 kg -> 83.33 %, 100 kg -> 60 %
//   max kg = 60 kg (or the body weight, if the patient weighs less than 60 kg -> 100 %)
// The RT side must enforce the same cap (the offload command carries kg and body weight).
import { config } from './config';

export const MAX_OFFLOAD_KG = Math.min(60, config.offloading.maxKg ?? 60);
const EPS = 1e-9;

// Body weight from the pre-session vitals (falls back to the patient record).
export function bodyWeightKg(vitals, patient) {
  const w = parseFloat(vitals?.weight ?? patient?.weight);
  return Number.isFinite(w) && w > 0 ? w : null;
}

// Exact upper limit for the set-point in the given unit (not rounded).
// Without a body weight the kg equivalent of a percentage is unknown, so % has no safe limit.
export function maxFor(unit, weight) {
  if (unit === 'kg') return weight ? Math.min(MAX_OFFLOAD_KG, weight) : MAX_OFFLOAD_KG;
  return weight ? Math.min(100, (MAX_OFFLOAD_KG / weight) * 100) : null;
}

// One press of the up/down arrow: whole steps, but the last step up lands exactly on the limit
// (83 -> 83.33 %), and stepping down from a fractional value snaps back to a whole step.
export function stepValue(value, dir, unit, weight) {
  const { step, min } = config.offloading;
  const max = maxFor(unit, weight);
  if (max == null) return value;
  const next = dir > 0
    ? (Math.floor(value / step + EPS) + 1) * step
    : (Math.ceil(value / step - EPS) - 1) * step;
  return Math.max(min, Math.min(max, next));
}

export const clampTo = (value, unit, weight) => {
  const max = maxFor(unit, weight);
  return max == null ? value : Math.max(config.offloading.min, Math.min(max, value));
};

// Offloaded weight in kg (null if the body weight is unknown and the unit is %).
export function offloadKg(value, unit, weight) {
  if (unit === 'kg') return value;
  return weight ? (weight * value) / 100 : null;
}

export function offloadPct(value, unit, weight) {
  if (unit !== 'kg') return value;
  return weight ? (value / weight) * 100 : null;
}

// Convert the set-point when the unit is switched, keeping the same physical load.
export function convert(value, from, to, weight) {
  if (from === to || !weight) return clampTo(value, to, weight);
  const next = to === 'kg' ? offloadKg(value, from, weight) : offloadPct(value, from, weight);
  return clampTo(Math.round(next * 100) / 100, to, weight);
}

export const atLimit = (value, unit, weight) => {
  const max = maxFor(unit, weight);
  return max != null && value >= max - 1e-6;
};

// Number formatting: whole numbers stay whole, otherwise up to 2 decimals (83.33).
export const fmt = (v, digits = 2) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const r = Math.round(v * 10 ** digits) / 10 ** digits;
  return Number.isInteger(r) ? String(r) : r.toFixed(digits).replace(/0+$/, '');
};

// "25 % (18 kg)" / "18 kg (25 %)" / "25 %"
export function describe(value, unit, weight) {
  if (unit === 'kg') {
    const pct = offloadPct(value, unit, weight);
    return pct == null ? `${fmt(value, 1)} kg` : `${fmt(value, 1)} kg (${fmt(pct)} %)`;
  }
  const kg = offloadKg(value, unit, weight);
  return kg == null ? `${fmt(value)} %` : `${fmt(value)} % (${fmt(kg, 1)} kg)`;
}
