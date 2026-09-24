import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../components/Layout';
import { BoxInput, Card, ConfirmModal, IconCircle, NextButton, T } from '../components/ui';
import { useApp } from '../state/AppState';
import { describe } from '../services/offloading';
import { LoadingOverlay } from '../components/LogoLoader';
import { api } from '../services/api';
import { MODES, fmtDuration } from './SessionScreen';
import { colors, font } from '../theme/tokens';

// End-of-session report: post-session vitals, stats from the controller, comments.
export default function SessionReport({ stats = {}, startedAt, endedAt, vitalsBefore }) {
  const { user, patient, reset, setVitalsBefore } = useApp();
  const [vitals, setVitals] = useState({ bp: '', spo2: '', hr: '' });
  const [comments, setComments] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const statRows = [
    ['Mode', stats.mode ? MODES[stats.mode]?.title : '—'],
    ['Duration', fmtDuration(stats.durationSec)],
    ['Offloading', stats.offloading != null ? describe(stats.offloading, stats.offloadUnit, stats.bodyWeightKg) : '—'],
    ['No of Breaks', stats.breaks ?? 0],
    ['No of Squats', stats.mode === 'squat' ? stats.squats : '—'],
    ['No of Steps', stats.mode === 'walk' ? stats.steps : '—'],
    ['Distance', stats.mode === 'walk' ? `${(stats.distanceM || 0).toFixed(1)} m` : '—'],
    ['Fall arrests', stats.fallArrests ?? 0],
  ];

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api.saveSession({
        patientId: patient?.id,
        therapistId: user?.id,
        date: (endedAt || new Date().toISOString()).slice(0, 10),
        startedAt,
        endedAt,
        mode: stats.mode,
        speed: stats.speed,
        offloading: stats.offloading,
        offloadUnit: stats.offloadUnit,
        offloadKg: stats.offloadKg,
        bodyWeightKg: stats.bodyWeightKg,
        durationSec: stats.durationSec,
        breaks: stats.breaks,
        steps: stats.steps,
        squats: stats.squats,
        distanceM: stats.distanceM,
        fallArrests: stats.fallArrests,
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

  const VITALS = [
    ['bp', 'Blood pressure', 'heartPulse', vitalsBefore?.bp],
    ['spo2', 'SpO2', 'drop', vitalsBefore?.spo2],
    ['hr', 'Heart Rate', 'heartPulse', vitalsBefore?.hr],
  ];

  return (
    <Screen title={user?.name} subtitle={patient?.fullName} lockNav>
      <View style={styles.cols}>
        <View style={styles.col}>
          <T style={styles.h}>PATIENT VITALS</T>
          <Card style={styles.card}>
            {VITALS.map(([k, label, icon, before], i) => (
              <View key={k} style={[styles.vRow, i < 2 && styles.line]}>
                <IconCircle name={icon} size={56} iconSize={28} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontSize: font.body }}>{label}</T>
                  <T style={{ fontSize: 12, color: colors.grey }}>Before: {before || '—'}</T>
                </View>
                <BoxInput style={{ width: 96, height: 42 }} inputStyle={{ textAlign: 'center', paddingHorizontal: 6 }} placeholder="Enter" value={vitals[k]} onChangeText={(t) => setVitals((v) => ({ ...v, [k]: t }))} />
              </View>
            ))}
          </Card>
        </View>
        <View style={styles.divider} />
        <View style={styles.col}>
          <T style={styles.h}>SESSION STATS</T>
          <Card style={[styles.card, { paddingVertical: 10 }]}>
            {statRows.map(([k, v], i) => (
              <View key={k} style={[styles.sRow, i < statRows.length - 1 && styles.line]}>
                <T style={{ fontSize: font.body }}>{k} -</T>
                <T style={{ fontSize: font.body, fontWeight: '700' }}>{String(v)}</T>
              </View>
            ))}
          </Card>
        </View>
        <View style={styles.divider} />
        <View style={styles.col}>
          <T style={styles.h}>COMMENTS</T>
          <BoxInput multiline style={[styles.card, { height: 260, padding: 6, borderWidth: 0, boxShadow: '0 4px 14px rgba(37,66,41,0.10)', borderRadius: 18 }]} placeholder="Therapist comments…" value={comments} onChangeText={setComments} />
        </View>
      </View>
      <View style={styles.footer}>
        <T style={{ color: '#D62828', fontWeight: '600' }}>{error}</T>
        <NextButton label="Save session" onPress={() => setConfirm(true)} />
      </View>
      <ConfirmModal
        visible={confirm}
        icon="home"
        title="SAVE SESSION"
        subtitle="The report will be stored on the controller"
        rows={[['Patient', patient?.fullName || '—'], ['Mode', stats.mode ? MODES[stats.mode]?.title : '—'], ['Duration', fmtDuration(stats.durationSec)]]}
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={save}
      />
      <LoadingOverlay visible={busy} message="Saving session report…" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cols: { flex: 1, flexDirection: 'row', paddingHorizontal: 40, paddingTop: 34, paddingBottom: 100 },
  col: { flex: 1, alignItems: 'center', paddingHorizontal: 20 },
  h: { fontSize: font.primary - 2, fontWeight: '600', marginBottom: 22 },
  card: { alignSelf: 'stretch', paddingHorizontal: 20, paddingVertical: 8 },
  vRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 20 },
  sRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.line },
  divider: { width: 1, backgroundColor: '#B9D6AD', marginVertical: 10 },
  footer: { position: 'absolute', left: 60, right: 90, bottom: 34, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
