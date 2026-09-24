import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../components/Layout';
import Icon from '../components/Icon';
import { BackButton, Card, PillButton, T } from '../components/ui';
import { useApp } from '../state/AppState';
import { colors, font } from '../theme/tokens';

export default function PatientHome() {
  const { user, patient, navigate, goBack } = useApp();
  if (!patient) return null;
  const rows = [
    ['Name', patient.fullName],
    ['Patient ID', patient.id],
    ['Age', patient.age ? `${patient.age} yrs` : '—'],
    ['Gender', patient.gender || '—'],
    ['Height', patient.height ? `${patient.height} cm` : '—'],
    ['Weight', patient.weight ? `${patient.weight} kg` : '—'],
  ];
  return (
    <Screen title={user?.name} subtitle={patient.fullName}>
      <View style={styles.wrap}>
        <Card style={styles.card}>
          <View style={styles.avatar}>
            <Icon name="user" size={80} color={colors.breakBrown} strokeWidth={1.6} />
          </View>
          {rows.map(([k, v]) => (
            <View key={k} style={styles.row}>
              <T style={styles.k}>{k}</T>
              <T style={styles.v} numberOfLines={1}>{v}</T>
            </View>
          ))}
        </Card>
        <View style={styles.divider} />
        <View style={styles.actions}>
          <PillButton label="View History" icon="history" width={261} height={68} onPress={() => navigate('PatientDetails', { patient })} />
          <View style={styles.sep} />
          <PillButton label="New Session" iconRight="chevronRight" width={261} height={68} onPress={() => navigate('Vitals')} textStyle={{ color: colors.primaryDark }} />
          <View style={styles.sep} />
          <PillButton label="Walk test" iconRight="chevronRight" width={261} height={68} onPress={() => navigate('Vitals', { preset: 'walk' })} textStyle={{ color: colors.primaryDark }} />
        </View>
      </View>
      <BackButton onPress={goBack} style={{ position: 'absolute', left: 60, bottom: 36 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 90, paddingBottom: 70 },
  card: { width: 380, height: 500, paddingHorizontal: 34, paddingTop: 26, alignItems: 'stretch' },
  avatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#fff', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 3px 10px rgba(0,0,0,0.12)' },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 11, gap: 12 },
  k: { fontSize: font.small, color: colors.grey },
  v: { fontSize: font.body, fontWeight: '600', flexShrink: 1 },
  divider: { width: 1, height: 420, backgroundColor: colors.line },
  actions: { alignItems: 'center', gap: 26 },
  sep: { width: 240, height: 1, backgroundColor: '#B9D6AD' },
});
