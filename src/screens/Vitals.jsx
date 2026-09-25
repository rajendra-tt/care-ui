import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../components/Layout';
import Icon from '../components/Icon';
import { BackButton, BoxInput, BpInput, Card, NextButton, T, bpError } from '../components/ui';
import { useApp } from '../state/AppState';
import { config } from '../services/config';
import { api } from '../services/api';
import { colors, font } from '../theme/tokens';

const MAX_WEIGHT = config.maxBodyWeightKg; // 136 kg

const FIELDS = [
  { k: 'weight', label: 'Weight', ph: `Enter Weight (kg, max ${MAX_WEIGHT})`, required: true, numeric: true, max: MAX_WEIGHT, unit: 'kg' },
  { k: 'bp', label: 'Blood Pressure', required: true, bp: true }, // systolic / diastolic boxes
  { k: 'spo2', label: 'SpO2', ph: 'Enter SpO2 (%)', required: true, numeric: true },
  { k: 'hr', label: 'Heart Rate', ph: 'Enter heart rate (bpm)', required: true, numeric: true },
  { k: 'notes', label: 'Notes', ph: 'Enter notes' },
];

// Range check for numeric fields that have limits (weight: above 0 and at most 136 kg).
function rangeError(f, val) {
  if (!f.max || !val) return undefined;
  const n = parseFloat(val);
  if (!Number.isFinite(n) || n <= 0) return 'Invalid';
  if (n > f.max) return `Max ${f.max} ${f.unit}`;
  return undefined;
}

export default function Vitals({ preset }) {
  const { user, patient, vitalsBefore, setVitalsBefore, navigate, goBack } = useApp();
  const [v, setV] = useState(vitalsBefore || { weight: patient?.weight ? String(patient.weight) : '' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);

  const next = async () => {
    if (busy) return;
    const e = {};
    FIELDS.forEach((f) => {
      const val = (v[f.k] || '').trim();
      const bad = rangeError(f, val);
      if (f.bp) e[f.k] = bpError(val);
      else if (f.required && !val) e[f.k] = 'Required';
      else if (bad) e[f.k] = bad;
    });
    Object.keys(e).forEach((k) => { if (!e[k]) delete e[k]; });
    setErr(e);
    if (Object.keys(e).length) return;
    // Opens the session on the device (POST /api/sessions); the device returns its session_id.
    setBusy(true);
    try {
      await api.openSession({ patientId: patient?.id, therapistId: user?.id, bodyWeightKg: parseFloat(v.weight), vitalsBefore: v });
    } catch (ex) {
      setErr({ _open: ex.message || 'Could not start the session' });
      return;
    } finally {
      setBusy(false);
    }
    setVitalsBefore({ ...v, takenAt: new Date().toISOString() });
    navigate('DeviceControl', { preset });
  };

  return (
    <Screen title={user?.name} subtitle={patient?.fullName}>
      <View style={styles.head}>
        <Icon name="heartPulse" size={40} color={colors.primary} strokeWidth={2} />
        <View>
          <T style={styles.h1}>PATIENT VITALS</T>
          <T style={styles.h2}>Enter the patient's vital signs before starting the session</T>
        </View>
      </View>
      <Card style={styles.card}>
        {FIELDS.map((f, i) => (
          <View key={f.k} style={[styles.row, i < FIELDS.length - 1 && styles.rowLine]}>
            <T style={styles.label}>{f.required ? '* ' : ''}{f.label}</T>
            {f.bp ? (
              <View style={{ width: 807 }}>
                <BpInput
                  value={v.bp}
                  invalid={!!err.bp}
                  onChange={(val) => { setV((s) => ({ ...s, bp: val })); setErr((s) => ({ ...s, bp: undefined })); }}
                />
              </View>
            ) : (
            <BoxInput
              style={[{ width: 807, height: 54 }, err[f.k] && { borderColor: '#E57373' }]}
              placeholder={f.ph}
              value={v[f.k] || ''}
              inputMode={f.numeric ? 'decimal' : 'text'}
              onChangeText={(t) => {
                const val = f.numeric ? t.replace(/[^0-9.]/g, '') : t;
                setV((s) => ({ ...s, [f.k]: val }));
                setErr((s) => ({ ...s, [f.k]: rangeError(f, val) })); // e.g. weight above 136 kg shows at once
              }}
            />
            )}
            <T style={styles.err}>{err[f.k] || ''}</T>
          </View>
        ))}
      </Card>
      <View style={styles.footer}>
        <BackButton onPress={goBack} />
        <T style={styles.openErr}>{err._open || ''}</T>
        <NextButton label={busy ? 'Starting…' : 'Start Session'} onPress={next} disabled={busy} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 60, paddingTop: 22 },
  h1: { fontSize: 30, fontWeight: '600', color: colors.primaryDark },
  h2: { fontSize: font.small, color: colors.grey },
  card: { marginHorizontal: 57, marginTop: 16, paddingHorizontal: 40, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  label: { width: 200, fontSize: font.secondary },
  err: { width: 90, color: '#D62828', fontSize: 13, marginLeft: 12 },
  footer: { position: 'absolute', left: 60, right: 60, bottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  openErr: { flex: 1, textAlign: 'center', color: '#D62828', fontSize: font.small, paddingHorizontal: 20 },
});
