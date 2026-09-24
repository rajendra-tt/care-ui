import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../components/Layout';
import { LiftControl, MovementControl } from '../components/Controls';
import { BackButton, Card, PillButton, T } from '../components/ui';
import { useApp } from '../state/AppState';
import { config } from '../services/config';
import { isMock } from '../services/api';
import { colors, font } from '../theme/tokens';

// Admin "Device" page: live controller status plus winch / movement jog for maintenance.
export default function DeviceAdmin() {
  const { user, goBack, telemetry: tm, connected, sendCommand } = useApp();
  const rows = [
    ['Connection', connected ? 'Connected' : 'Not responding'],
    ['Transport', isMock ? 'Simulator (mock)' : `LabVIEW Web Service ${config.apiBase || '(same host)'}${config.apiPrefix}`],
    ['Controller state', tm.state],
    ['E-stop', tm.state === 'estop' ? 'ENGAGED' : 'Released'],
    ['Lift position', tm.liftPosition != null ? `${tm.liftPosition} %` : '—'],
    ['Offloading', `${tm.offloading} ${tm.offloadUnit === 'kg' ? 'kg' : '%'}`],
    ['Battery', tm.battery != null ? `${tm.battery} %` : '—'],
    ['Status poll', `${config.statusPollMs} ms`],
    ['Jog repeat', `${config.jogRepeatMs} ms`],
  ];
  const estop = tm.state === 'estop';
  return (
    <Screen title={user?.name}>
      <View style={styles.wrap}>
        <Card style={styles.status}>
          <T style={styles.h}>DEVICE STATUS</T>
          {rows.map(([k, v]) => (
            <View key={k} style={styles.row}>
              <T style={{ color: colors.grey, fontSize: font.small }}>{k}</T>
              <T style={{ fontWeight: '700', fontSize: font.body, color: k === 'E-stop' && estop ? colors.danger : colors.text }}>{v}</T>
            </View>
          ))}
          <PillButton
            label={estop ? 'Release E-stop' : 'Engage E-stop'}
            variant={estop ? 'outlineGreen' : 'logout'}
            width={220}
            height={48}
            fontSize={font.body}
            style={{ marginTop: 20, alignSelf: 'center' }}
            onPress={() => sendCommand({ cmd: 'estop', action: estop ? 'release' : 'engage' }).catch(() => {})}
          />
        </Card>
        <View style={{ gap: 20 }}>
          <Card style={styles.ctrl}><T style={styles.h}>WINCH</T><LiftControl title={null} disabled={estop} size={66} /></Card>
          <Card style={[styles.ctrl, { height: 330 }]}><T style={styles.h}>MOVEMENT</T><MovementControl title={null} disabled={estop} size={60} /></Card>
        </View>
      </View>
      <BackButton onPress={goBack} style={{ position: 'absolute', left: 60, bottom: 28 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 40, paddingTop: 24 },
  status: { width: 560, height: 560, paddingHorizontal: 30, paddingTop: 20 },
  h: { fontSize: font.secondary, fontWeight: '700', textAlign: 'center', marginBottom: 12, letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  ctrl: { width: 400, height: 210, paddingTop: 16, alignItems: 'center' },
});
