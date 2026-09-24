import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../components/Layout';
import { LiftColumn, MovementPad, OffloadingPanel } from '../components/Controls';
import { BackButton, NextButton, T } from '../components/ui';
import { useApp } from '../state/AppState';

// Pre-session set-up: position the patient (lift + device movement) and set offloading.
export default function DeviceControl({ preset }) {
  const { user, patient, navigate, goBack, telemetry } = useApp();
  const estop = telemetry.state === 'estop';
  return (
    <Screen title={user?.name} subtitle={patient?.fullName}>
      <View style={styles.cols}>
        <View style={styles.col}>
          <T style={styles.h}>PATIENT LIFT</T>
          <View style={styles.colBody}><LiftColumn disabled={estop} /></View>
        </View>
        <View style={styles.col}>
          <T style={styles.h}>OFFLOADING</T>
          <View style={styles.colBody}><OffloadingPanel style={{ width: 380, height: 440 }} gaugeSize={180} disabled={estop} /></View>
        </View>
        <View style={styles.col}>
          <T style={styles.h}>DEVICE CONTROL</T>
          <View style={styles.colBody}><MovementPad disabled={estop} /></View>
        </View>
      </View>
      <View style={styles.footer}>
        <BackButton onPress={goBack} />
        <NextButton label="Next" onPress={() => navigate('Session', { preset })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cols: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 30, paddingTop: 44, paddingBottom: 110 },
  col: { alignItems: 'center', width: 380 },
  h: { fontSize: 20, fontWeight: '600', letterSpacing: 0.5 },
  colBody: { flex: 1, justifyContent: 'center' },
  footer: { position: 'absolute', left: 150, right: 150, bottom: 34, flexDirection: 'row', justifyContent: 'space-between' },
});
