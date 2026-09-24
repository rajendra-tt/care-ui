import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Screen } from '../components/Layout';
import Icon from '../components/Icon';
import { BackButton, Card, ConfirmModal, NextButton, T } from '../components/ui';
import { useApp } from '../state/AppState';
import { api } from '../services/api';
import { colors, font } from '../theme/tokens';

export default function TherapistDetails({ therapist }) {
  const { user, goBack } = useApp();
  const [all, setAll] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.listPatients().then(setAll).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);

  const mine = all.filter((p) => p.therapistId === therapist.id);
  const others = all.filter((p) => p.therapistId !== therapist.id);

  const assign = async () => {
    setBusy(true);
    try { await api.assignPatient(therapist.id, pick.id); await load(); setAssigning(false); setPick(null); } finally { setBusy(false); }
  };

  return (
    <Screen title={user?.name}>
      <Card style={styles.head}>
        <View style={{ alignItems: 'center', width: 150 }}>
          <Icon name="user" size={64} color={colors.primary} strokeWidth={1.5} />
          <T style={{ fontSize: font.small, marginTop: 6 }}>{therapist.name}</T>
        </View>
        <View style={styles.vline} />
        <View style={styles.info}>
          <T style={styles.infoT}>Name - <T style={{ fontWeight: '700' }}>{therapist.name}</T></T>
          <T style={styles.infoT}>Username - <T style={{ fontWeight: '700' }}>{therapist.username || '—'}</T></T>
          <T style={styles.infoT}>Assigned patients - <T style={{ fontWeight: '700' }}>{mine.length}</T></T>
        </View>
      </Card>
      <Card style={styles.table}>
        <T style={{ textAlign: 'center', fontSize: font.body, fontWeight: '600', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}>Patients</T>
        <ScrollView contentContainerStyle={{ padding: 10, gap: 6 }}>
          {mine.map((p) => (
            <View key={p.id} style={styles.pRow}>
              <T style={{ width: 90, color: colors.grey }}>{p.id}</T>
              <T style={{ flex: 1, fontWeight: '600' }}>{p.fullName}</T>
              <T style={{ flex: 1, color: colors.textMuted }}>{p.diagnosis || '—'}</T>
            </View>
          ))}
          {!mine.length ? <T style={{ textAlign: 'center', color: colors.grey, marginTop: 30 }}>No patients assigned.</T> : null}
        </ScrollView>
      </Card>
      <View style={styles.footer}>
        <BackButton onPress={goBack} />
        <NextButton label="Assign New patient" onPress={() => setAssigning(true)} width={240} />
      </View>
      <ConfirmModal
        visible={assigning}
        icon="userPlus"
        title="Assign Patient"
        subtitle={`Select a patient to assign to ${therapist.name}`}
        busy={busy}
        confirmDisabled={!pick}
        onCancel={() => { setAssigning(false); setPick(null); }}
        onConfirm={assign}
      >
        <ScrollView style={{ maxHeight: 200 }} contentContainerStyle={{ gap: 6 }}>
          {others.map((p) => (
            <Pressable key={p.id} onPress={() => setPick(p)} style={[styles.pick, pick?.id === p.id && { backgroundColor: colors.selectedMode, borderColor: colors.primary }]}>
              <T style={{ fontWeight: '600' }}>{p.fullName}</T>
              <T style={{ color: colors.grey, fontSize: 13 }}>{p.id}</T>
            </Pressable>
          ))}
        </ScrollView>
      </ConfirmModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { marginHorizontal: 36, marginTop: 22, height: 150, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  vline: { width: 1, height: 110, backgroundColor: colors.line, marginHorizontal: 20 },
  info: { flex: 1, backgroundColor: '#F5F7F4', borderRadius: 12, padding: 18, gap: 8 },
  infoT: { fontSize: font.body },
  table: { marginHorizontal: 36, marginTop: 20, height: 380, paddingHorizontal: 10 },
  pRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#EEF2EC' },
  footer: { position: 'absolute', left: 60, right: 60, bottom: 28, flexDirection: 'row', justifyContent: 'space-between' },
  pick: { flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, cursor: 'pointer' },
});
