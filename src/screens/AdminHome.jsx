import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../components/Layout';
import Icon from '../components/Icon';
import { Card, PillButton, T } from '../components/ui';
import { useApp } from '../state/AppState';
import { colors, font } from '../theme/tokens';

const TILES = [
  { key: 'PatientList', params: { adminView: true }, title: 'Patient', desc: 'View and manage patient profiles', ring: colors.breakBrown, icon: 'user' },
  { key: 'TherapistList', title: 'Therapist', desc: 'Manage therapist settings and sessions', ring: colors.primary, icon: 'user' },
  { key: 'DeviceAdmin', title: 'Device', desc: 'Control and configure medical devices', ring: '#6E6E6E', icon: 'device' },
];

export default function AdminHome() {
  const { user, navigate, logout } = useApp();
  return (
    <Screen title={user?.name}>
      <View style={{ alignItems: 'center', marginTop: 40 }}>
        <T style={{ fontSize: font.headline - 5, fontWeight: '600', letterSpacing: 1 }}>Welcome, Admin!</T>
        <T style={{ fontSize: font.body, color: colors.grey, marginTop: 4 }}>Select a profile to continue</T>
      </View>
      <View style={styles.row}>
        {TILES.map((t) => (
          <Pressable key={t.key} onPress={() => navigate(t.key, t.params)} style={({ pressed }) => [pressed && { transform: [{ scale: 0.98 }] }]}>
            <Card style={styles.tile}>
              <View style={[styles.ring, { borderColor: t.ring }]}>
                <Icon name={t.icon} size={76} color={t.ring} strokeWidth={1.5} />
              </View>
              <T style={styles.title}>{t.title}</T>
              <T style={styles.desc}>{t.desc}</T>
              <View style={styles.go}><Icon name="chevronRight" size={18} color={colors.primaryDark} /></View>
            </Card>
          </Pressable>
        ))}
      </View>
      <PillButton label="Log Out" icon="logout" variant="logout" width={160} height={46} fontSize={font.body} onPress={logout} style={{ position: 'absolute', left: 60, bottom: 36 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 50, marginTop: 50 },
  tile: { width: 290, height: 400, alignItems: 'center', paddingTop: 34, paddingHorizontal: 26, borderRadius: 24 },
  ring: { width: 150, height: 150, borderRadius: 75, borderWidth: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' },
  title: { fontSize: 22, fontWeight: '600', marginTop: 26 },
  desc: { fontSize: font.small, color: colors.grey, marginTop: 8, textAlign: 'center' },
  go: { position: 'absolute', bottom: 26, width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' },
});
