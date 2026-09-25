import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Screen } from '../components/Layout';
import Icon from '../components/Icon';
import { BackButton, Card, T } from '../components/ui';
import { ReportModal } from '../components/SessionSummary';
import { useApp } from '../state/AppState';
import { api } from '../services/api';
import { MODES, fmtDuration } from './SessionScreen';
import { colors, font } from '../theme/tokens';

const COLS = [['Date', 1.1], ['Session ID', 1], ['Therapist ID', 1], ['Duration', 1], ['Details', 1.3], ['Report', 1]];

// Patient profile + session history (admin "Patient" and therapist "View History").
export default function PatientDetails({ patient }) {
  const { user, goBack } = useApp();
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listSessions(patient.id).then((s) => setSessions([...s].sort((a, b) => (a.date < b.date ? 1 : -1)))).catch((e) => setError(e.message));
  }, [patient.id]);

  return (
    <Screen title={user?.name}>
      <Card style={styles.head}>
        <View style={{ alignItems: 'center', width: 150 }}>
          <Icon name="user" size={64} color={colors.primary} strokeWidth={1.5} />
          <T style={{ fontSize: font.small, marginTop: 6 }}>{patient.fullName}</T>
        </View>
        <View style={styles.vline} />
        <View style={styles.info}>
          <T style={styles.infoT}>Name - <T style={{ fontWeight: '700' }}>{patient.fullName}</T>   ·   ID - <T style={{ fontWeight: '700' }}>{patient.id}</T></T>
          <T style={styles.infoT}>Age - <T style={{ fontWeight: '700' }}>{patient.age ?? '—'}</T>   ·   Gender - <T style={{ fontWeight: '700' }}>{patient.gender || '—'}</T></T>
          <T style={styles.infoT}>Condition - <T style={{ fontWeight: '700' }}>{patient.diagnosis || '—'}</T></T>
        </View>
      </Card>
      <Card style={styles.table}>
        <View style={styles.tr}>
          {COLS.map(([c, f]) => <T key={c} style={[styles.th, { flex: f }]}>{c}</T>)}
        </View>
        <ScrollView>
          {sessions.map((s) => (
            <View key={s.id} style={styles.tr}>
              <T style={[styles.td, { flex: 1.1 }]}>{s.date}</T>
              <T style={[styles.td, { flex: 1 }]}>{s.id}</T>
              <T style={[styles.td, { flex: 1 }]}>{s.therapistId}</T>
              <T style={[styles.td, { flex: 1 }]}>{fmtDuration(s.durationSec)}</T>
              <T style={[styles.td, { flex: 1.3 }]}>{(s.exercises?.length ? s.exercises.map((e) => MODES[e.mode]?.label || e.mode).join(', ') : MODES[s.mode]?.title) || '—'}</T>
              <View style={[styles.tdBox, { flex: 1 }]}>
                <Pressable onPress={() => setOpen(s)} style={styles.getReport}>
                  <Icon name="report" size={16} color={colors.primary} />
                  <T style={{ fontSize: 13, color: colors.primary }}>Get Report</T>
                </Pressable>
              </View>
            </View>
          ))}
          {!sessions.length ? <T style={{ textAlign: 'center', color: colors.grey, marginTop: 40 }}>{error || 'No sessions recorded yet.'}</T> : null}
        </ScrollView>
      </Card>
      <BackButton onPress={goBack} style={{ position: 'absolute', left: 60, bottom: 28 }} />
      <ReportModal session={open} patient={patient} onClose={() => setOpen(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { marginHorizontal: 36, marginTop: 22, height: 150, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  vline: { width: 1, height: 110, backgroundColor: colors.line, marginHorizontal: 20 },
  info: { flex: 1, backgroundColor: '#F5F7F4', borderRadius: 12, padding: 18, gap: 8 },
  infoT: { fontSize: font.body },
  table: { marginHorizontal: 36, marginTop: 20, height: 390, overflow: 'hidden' },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEF2EC', minHeight: 48 },
  th: { fontSize: font.small, fontWeight: '700', textAlign: 'center', paddingVertical: 14, borderRightWidth: 1, borderRightColor: '#EEF2EC' },
  td: { fontSize: font.small, textAlign: 'center', paddingVertical: 14, borderRightWidth: 1, borderRightColor: '#EEF2EC' },
  tdBox: { alignItems: 'center', justifyContent: 'center' },
  getReport: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, cursor: 'pointer' },
});
