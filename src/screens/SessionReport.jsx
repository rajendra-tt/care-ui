import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../components/Layout';
import { BoxInput, BpInput, ConfirmModal, NextButton, T, bpError } from '../components/ui';
import { SummaryOverview, VitalsTable, fmtTime } from '../components/SessionSummary';
import { useApp } from '../state/AppState';
import { LoadingOverlay } from '../components/LogoLoader';
import { api } from '../services/api';
import { MODES } from './SessionScreen';
import { colors, font } from '../theme/tokens';

// End-of-session report: vitals before / after, the session summary from the controller
// (exercises, fall arrests, unloading...), comments.
export default function SessionReport({ stats = {}, startedAt, endedAt, vitalsBefore }) {
  const { user, patient, reset, setVitalsBefore } = useApp();
  const [vitals, setVitals] = useState({ bp: '', spo2: '', hr: '' });
  const [comments, setComments] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const bpInvalid = !!vitals.bp && !!bpError(vitals.bp);

  const askSave = () => {
    if (bpInvalid) { setError(`Blood pressure after: ${bpError(vitals.bp)}`); return; }
    setError('');
    setConfirm(true);
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api.saveSession({
        ...stats, // the controller's totals: exercises, unloading, fall arrests, ...
        sessionId: stats.sessionId ?? stats.id,
        patientId: patient?.id,
        therapistId: user?.id,
        date: (endedAt || new Date().toISOString()).slice(0, 10),
        startedAt,
        endedAt,
        vitalsBefore,
        vitalsAfter: vitals,
        comments,
      });
      setVitalsBefore(null);
      setConfirm(false);
      reset('PatientList');
    } catch (e) {
      setError(e.message || 'Could not save session');
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  const setVital = (k) => (t) => setVitals((v) => ({ ...v, [k]: k === 'bp' ? t : t.replace(/[^0-9.]/g, '') }));
  const afterInput = (k) =>
    k === 'bp' ? (
      <BpInput value={vitals.bp} onChange={setVital('bp')} boxWidth={54} height={40} invalid={bpInvalid} showUnit={false} />
    ) : (
      <BoxInput
        style={{ width: 90, height: 40 }}
        inputStyle={{ textAlign: 'center', paddingHorizontal: 6, fontWeight: '600' }}
        placeholder={k === 'spo2' ? '98' : '80'}
        inputMode="numeric"
        value={vitals[k]}
        onChangeText={setVital(k)}
      />
    );

  return (
    <Screen title={user?.name} subtitle={patient?.fullName} lockNav>
      <View style={styles.cols}>
        <View style={[styles.col, { flex: 1.1 }]}>
          <T style={styles.h}>PATIENT VITALS</T>
          <VitalsTable before={vitalsBefore} renderAfter={afterInput} />
          <T style={styles.hint}>Enter the vitals after the session. Blood pressure: systolic / diastolic.</T>
        </View>
        <View style={styles.divider} />
        <View style={[styles.col, { flex: 1.3 }]}>
          <T style={styles.h}>SESSION SUMMARY</T>
          <SummaryOverview s={stats} compact />
        </View>
        <View style={styles.divider} />
        <View style={[styles.col, { flex: 0.7 }]}>
          <T style={styles.h}>COMMENTS</T>
          <BoxInput multiline style={styles.comments} placeholder="Therapist comments…" value={comments} onChangeText={setComments} />
        </View>
      </View>
      <View style={styles.footer}>
        <T style={{ color: '#D62828', fontWeight: '600' }}>{error}</T>
        <NextButton label="Save session" onPress={askSave} />
      </View>
      <ConfirmModal
        visible={confirm}
        icon="home"
        title="SAVE SESSION"
        subtitle="The report will be stored on the controller"
        rows={[
          ['Patient', patient?.fullName || '—'],
          ['Exercises', (stats.exercises?.length ? stats.exercises.map((e) => MODES[e.mode]?.label || e.mode).join(', ') : MODES[stats.mode]?.label) || '—'],
          ['Exercise time', fmtTime(stats.durationSec)],
        ]}
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={save}
      />
      <LoadingOverlay visible={busy} message="Saving session report…" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cols: { flex: 1, flexDirection: 'row', paddingHorizontal: 34, paddingTop: 26, paddingBottom: 100 },
  col: { paddingHorizontal: 18 },
  h: { fontSize: font.secondary + 2, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  hint: { fontSize: font.tiny, color: colors.grey, marginTop: 10, textAlign: 'center' },
  comments: { height: 330, padding: 6, borderWidth: 0, boxShadow: '0 4px 14px rgba(37,66,41,0.10)', borderRadius: 18 },
  divider: { width: 1, backgroundColor: '#B9D6AD', marginVertical: 10 },
  footer: { position: 'absolute', left: 60, right: 90, bottom: 34, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
