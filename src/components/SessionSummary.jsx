// Session report building blocks, shared by the end-of-session screen (SessionReport) and
// "Get Report" in the patient history (PatientDetails):
//   SummaryOverview  - totals (time, pauses, breaks, fall arrests), the exercises done and unloading
//   VitalsTable      - vitals before and after the session, side by side
//   ReportModal      - the full report pop-up (both of the above + comments, Print / Close)
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { IconCircle, PillButton, T } from './ui';
import { colors, font, radius, shadow } from '../theme/tokens';

const EXERCISE = { balance: 'Balance', walk: 'Walking', squat: 'Squatting' };

export const fmtTime = (sec) => {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};
const dash = (v, unit = '') => (v === null || v === undefined || v === '' || Number.isNaN(v) ? '—' : `${v}${unit}`);
const kg = (v) => (v == null ? '—' : `${Number(v).toFixed(1)} kg`);

// Exercises done in the session. Older records only have totals per mode (or a single mode).
function exercisesOf(s) {
  if (s.exercises?.length) return s.exercises;
  const list = [['balance', s.balanceSec], ['walk', s.walkingSec], ['squat', s.squatSec]]
    .filter(([, sec]) => sec > 0)
    .map(([mode, sec]) => ({ mode, sec, speed: mode === 'walk' && s.speed ? s.speed : '' }));
  if (list.length) return list;
  return s.mode ? [{ mode: s.mode, sec: s.durationSec, speed: s.speed || '' }] : [];
}

function exerciseDetails(e, s) {
  if (e.mode === 'walk') {
    const parts = [`${dash(s.steps)} steps`, `${Number(s.distanceM || 0).toFixed(1)} m`];
    if (e.speed) parts.push(String(e.speed).replace(/^./, (c) => c.toUpperCase()));
    return parts.join(' · ');
  }
  if (e.mode === 'squat') return `${dash(s.squats)} sit-to-stand`;
  return 'Static balance';
}

const Section = ({ title, children, style }) => (
  <View style={[styles.section, style]}>
    <T style={styles.sectionTitle}>{title}</T>
    {children}
  </View>
);

const Tile = ({ label, value, sub, warn }) => (
  <View style={styles.tile}>
    <T style={[styles.tileValue, warn && { color: colors.breakBrown }]} numberOfLines={1}>{value}</T>
    {sub ? <T style={styles.tileSub}>{sub}</T> : null}
    <T style={styles.tileLabel}>{label}</T>
  </View>
);

export function SummaryOverview({ s, compact }) {
  const ex = exercisesOf(s);
  const avgPct = s.avgUnloadPct != null ? `${Number(s.avgUnloadPct).toFixed(0)} % of weight` : null;
  return (
    <View style={{ gap: compact ? 12 : 16 }}>
      <View style={styles.tiles}>
        <Tile label="Exercise time" value={fmtTime(s.durationSec)} />
        <Tile label="Paused" value={fmtTime(s.pauseSec)} />
        <Tile label="Breaks" value={dash(s.breaks ?? 0)} />
        <Tile label="Fall arrests" value={dash(s.fallArrests ?? 0)} warn={s.fallArrests > 0} />
      </View>

      <Section title="EXERCISES">
        <View style={styles.table}>
          <View style={[styles.tr, styles.thead]}>
            <T style={[styles.th, { flex: 1.1 }]}>Exercise</T>
            <T style={[styles.th, { flex: 0.8 }]}>Time</T>
            <T style={[styles.th, { flex: 2 }]}>Details</T>
          </View>
          {ex.length ? ex.map((e, i) => (
            <View key={`${e.mode}${i}`} style={[styles.tr, i === ex.length - 1 && { borderBottomWidth: 0 }]}>
              <T style={[styles.td, styles.tdStrong, { flex: 1.1 }]}>{EXERCISE[e.mode] || e.mode}</T>
              <T style={[styles.td, { flex: 0.8 }]}>{fmtTime(e.sec)}</T>
              <T style={[styles.td, { flex: 2 }]}>{exerciseDetails(e, s)}</T>
            </View>
          )) : <T style={[styles.td, { paddingVertical: 12 }]}>No exercise recorded</T>}
        </View>
      </Section>

      <Section title="UNLOADING">
        <View style={styles.tiles}>
          <Tile label="Average" value={kg(s.avgUnloadKg)} sub={avgPct} />
          <Tile label="Highest" value={kg(s.maxUnloadKg)} />
          <Tile label="Lowest" value={kg(s.minUnloadKg)} />
          <Tile label="Body weight" value={kg(s.bodyWeightKg)} />
        </View>
      </Section>
    </View>
  );
}

const VITAL_ROWS = [
  ['bp', 'Blood pressure', 'mmHg'],
  ['spo2', 'SpO2', '%'],
  ['hr', 'Heart rate', 'bpm'],
  ['weight', 'Weight', 'kg'],
];

// renderAfter(key) lets the report screen put input fields in the "After" column.
export function VitalsTable({ before = {}, after = {}, renderAfter }) {
  return (
    <View style={styles.table}>
      <View style={[styles.tr, styles.thead]}>
        <T style={[styles.th, { flex: 1.3 }]}>Vital</T>
        <T style={[styles.th, { flex: 1 }]}>Before</T>
        <T style={[styles.th, { flex: renderAfter ? 1.6 : 1 }]}>After</T>
      </View>
      {VITAL_ROWS.map(([k, label, unit], i) => {
        const afterCell = k === 'weight' ? <T style={styles.muted}>—</T> : renderAfter ? renderAfter(k) : <T style={styles.tdValue}>{dash(after?.[k])}</T>;
        return (
          <View key={k} style={[styles.tr, styles.vitalRow, i === VITAL_ROWS.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1.3, paddingLeft: 14 }}>
              <T style={styles.tdStrong}>{label}</T>
              <T style={styles.unit}>{unit}</T>
            </View>
            <View style={styles.cell}><T style={styles.tdValue}>{dash(before?.[k])}</T></View>
            <View style={[styles.cell, { flex: renderAfter ? 1.6 : 1 }]}>{afterCell}</View>
          </View>
        );
      })}
    </View>
  );
}

export function ReportModal({ session: s, patient, onClose }) {
  if (!s) return null;
  return (
    <View style={styles.backdrop}>
      <View style={[styles.modal, shadow.modal]}>
        <View style={styles.modalHead}>
          <IconCircle name="report" size={48} iconSize={24} />
          <View style={{ flex: 1 }}>
            <T style={styles.modalTitle}>Session report</T>
            <T style={styles.modalSub}>
              {[patient?.fullName, s.date, `Session ${s.id}`, s.therapistId != null ? `Therapist ${s.therapistId}` : null].filter(Boolean).join('  ·  ')}
            </T>
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalBody}>
          <View style={{ flex: 1.25 }}>
            <SummaryOverview s={s} />
          </View>
          <View style={{ flex: 1, gap: 16 }}>
            <Section title="VITALS">
              <VitalsTable before={s.vitalsBefore} after={s.vitalsAfter} />
            </Section>
            <Section title="COMMENTS">
              <View style={styles.comments}>
                <T style={{ fontSize: font.small, color: s.comments ? colors.text : colors.grey }}>{s.comments || 'No comments'}</T>
              </View>
            </Section>
          </View>
        </ScrollView>
        <View style={styles.modalFoot}>
          <PillButton label="Close" variant="cancel" width={180} height={48} fontSize={font.body} onPress={onClose} />
          <PillButton label="Print" icon="report" variant="confirm" width={180} height={48} fontSize={font.body} onPress={() => window.print()} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionTitle: { fontSize: font.tiny, fontWeight: '700', letterSpacing: 1.2, color: colors.textMuted },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, backgroundColor: colors.mintLight, borderRadius: radius.tile, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
  tileValue: { fontSize: font.secondary, fontWeight: '700', color: colors.primaryDark },
  tileLabel: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  tileSub: { fontSize: 11, color: colors.primary, fontWeight: '600', textAlign: 'center' },
  table: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.white },
  tr: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEF2EC', minHeight: 40 },
  thead: { backgroundColor: '#F5F8F3', minHeight: 34 },
  th: { fontSize: font.tiny, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
  td: { fontSize: font.small, textAlign: 'center', paddingVertical: 8, paddingHorizontal: 6 },
  tdStrong: { fontSize: font.small, fontWeight: '600' },
  tdValue: { fontSize: font.body, fontWeight: '600', textAlign: 'center' },
  vitalRow: { minHeight: 56 },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  unit: { fontSize: font.tiny, color: colors.grey },
  muted: { fontSize: font.body, color: colors.greyLight },
  comments: { backgroundColor: colors.mintLight, borderRadius: 12, padding: 14, minHeight: 90 },
  backdrop: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(237,242,233,0.55)', backdropFilter: 'blur(3px)', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  modal: { width: 1120, height: 700, backgroundColor: colors.white, borderRadius: radius.modal, paddingTop: 22, paddingBottom: 18, paddingHorizontal: 30 },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  modalTitle: { fontSize: 24, fontWeight: '700' },
  modalSub: { fontSize: font.small, color: colors.grey, marginTop: 2 },
  modalBody: { flexDirection: 'row', gap: 26, paddingTop: 16, paddingBottom: 8 },
  modalFoot: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
});
