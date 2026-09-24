import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Screen } from '../components/Layout';
import Icon from '../components/Icon';
import { BackButton, Card, ConfirmModal, IconCircle, NextButton, T } from '../components/ui';
import { useApp } from '../state/AppState';
import { api } from '../services/api';
import { colors, font } from '../theme/tokens';

// Tab 1 fields come from the UI flow video. Fields on tabs 2-5 were not shown in
// the design files; they are reasonable placeholders to be confirmed with the clinic.
const TABS = [
  {
    key: 'patient', label: 'Patient Information',
    sections: [
      { title: 'Basic Information', icon: 'userSolid', fields: [
        { k: 'fullName', label: 'Full name', ph: 'Enter patient full name', icon: 'userSolid', required: true },
        [{ k: 'age', label: 'Age', ph: 'Enter age', icon: 'calendar', numeric: true, required: true },
          { k: 'gender', label: 'Gender', ph: 'Select gender', icon: 'gender', options: ['Male', 'Female', 'Other'], required: true }],
        [{ k: 'height', label: 'Height', ph: 'Enter height (cm)', icon: 'height', numeric: true },
          { k: 'weight', label: 'Weight', ph: 'Enter weight (Kg)', icon: 'weight', numeric: true }],
        { k: 'occupation', label: 'Occupation', ph: 'Enter occupation', icon: 'briefcase' },
        { k: 'address', label: 'Address', ph: 'Enter address', icon: 'pin' },
        { k: 'hospitalNo', label: 'Hospital No.', ph: 'Enter Hosp. No.', icon: 'idCard' },
        { k: 'diagnosis', label: 'Diagnosis', ph: 'Enter Diagnosis', icon: 'stethoscope' },
      ] },
      { title: 'Medical History', icon: 'heartPulse', fields: [
        { k: 'medicalHistory', label: 'Medical History', ph: 'Enter medical history', icon: 'hourglass' },
        { k: 'surgeryHistory', label: 'Surgery History', ph: 'Enter surgery history', icon: 'clipboard' },
      ] },
    ],
  },
  {
    key: 'medical', label: 'Medical Information',
    sections: [{ title: 'Medical Information', icon: 'stethoscope', fields: [
      [{ k: 'onsetDate', label: 'Date of onset / injury', ph: 'DD-MM-YYYY', icon: 'calendar' },
        { k: 'affectedSide', label: 'Affected side', ph: 'Select side', icon: 'user', options: ['Left', 'Right', 'Bilateral', 'N/A'] }],
      { k: 'medications', label: 'Current medications', ph: 'Enter medications', icon: 'clipboard' },
      { k: 'allergies', label: 'Allergies', ph: 'Enter allergies', icon: 'drop' },
      { k: 'precautions', label: 'Precautions / contraindications', ph: 'Enter precautions', icon: 'stop' },
    ] }],
  },
  {
    key: 'cardio', label: 'Cardiopulmonary',
    sections: [{ title: 'Cardiopulmonary', icon: 'heartPulse', fields: [
      [{ k: 'restingHr', label: 'Resting heart rate', ph: 'bpm', icon: 'heartPulse', numeric: true },
        { k: 'restingBp', label: 'Resting blood pressure', ph: 'e.g. 120/80', icon: 'heartPulse' }],
      [{ k: 'restingSpo2', label: 'Resting SpO2', ph: '%', icon: 'drop', numeric: true },
        { k: 'respRate', label: 'Respiratory rate', ph: 'breaths/min', icon: 'hourglass', numeric: true }],
      { k: 'cardiacConditions', label: 'Cardiac / pulmonary conditions', ph: 'Enter conditions', icon: 'clipboard' },
    ] }],
  },
  {
    key: 'ortho', label: 'Orthopedic',
    sections: [{ title: 'Orthopedic', icon: 'steps', fields: [
      { k: 'affectedJoints', label: 'Affected joints / region', ph: 'Enter region', icon: 'user' },
      { k: 'weightBearing', label: 'Weight bearing status', ph: 'Select status', icon: 'weight', options: ['Full', 'Partial', 'Toe-touch', 'Non-weight bearing'] },
      { k: 'romLimits', label: 'Range of motion limitations', ph: 'Enter limitations', icon: 'clipboard' },
      { k: 'implants', label: 'Implants / fixation', ph: 'Enter details', icon: 'idCard' },
    ] }],
  },
  {
    key: 'neuro', label: 'Neurological',
    sections: [{ title: 'Neurological', icon: 'balance', fields: [
      { k: 'neuroCondition', label: 'Neurological condition', ph: 'Enter condition', icon: 'stethoscope' },
      [{ k: 'injuryLevel', label: 'Level of injury', ph: 'e.g. T10', icon: 'height' },
        { k: 'spasticity', label: 'Spasticity (MAS)', ph: 'Select grade', icon: 'hourglass', options: ['0', '1', '1+', '2', '3', '4'] }],
      { k: 'balanceScore', label: 'Balance score (BBS)', ph: 'Enter score', icon: 'balance', numeric: true },
      { k: 'cognition', label: 'Cognition / communication', ph: 'Enter notes', icon: 'clipboard' },
    ] }],
  },
];

export default function AddPatient() {
  const { user, goBack } = useApp();
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  const validate = () => {
    const e = {};
    if (!form.fullName?.trim()) e.fullName = 'Required';
    if (!form.age || Number.isNaN(Number(form.age)) || Number(form.age) <= 0 || Number(form.age) > 120) e.age = 'Enter a valid age';
    if (!form.gender) e.gender = 'Required';
    setErrors(e);
    if (Object.keys(e).length) setTab(0);
    return !Object.keys(e).length;
  };

  const next = () => {
    if (tab < TABS.length - 1) setTab(tab + 1);
    else if (validate()) setConfirm(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const num = (v) => (v === undefined || v === '' ? undefined : Number(v));
      await api.createPatient({ ...form, fullName: form.fullName.trim(), age: num(form.age), height: num(form.height), weight: num(form.weight), therapistId: user?.role === 'therapist' ? user.id : undefined });
      setConfirm(false);
      goBack();
    } catch (e) {
      setErrors({ _save: e.message });
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  const current = TABS[tab];
  return (
    <Screen title={user?.name}>
      <View style={styles.tabs}>
        {TABS.map((t, i) => (
          <Pressable key={t.key} onPress={() => setTab(i)} style={[styles.tab, i === tab && styles.tabActive]}>
            <T style={[styles.tabText, i === tab && { color: colors.primaryDark, fontWeight: '600' }]}>{t.label}</T>
          </Pressable>
        ))}
      </View>
      <View style={styles.body}>
        <View style={styles.stepper}>
          <T style={{ color: colors.primary, fontSize: font.body }}>New Patient Registration</T>
          <T style={styles.stepTitle}>{current.label}</T>
          {TABS.map((t, i) => (
            <Pressable key={t.key} onPress={() => setTab(i)} style={styles.step}>
              <View style={[styles.stepNum, i === tab && { backgroundColor: colors.primary, borderColor: colors.primary }, i < tab && { borderColor: colors.primary }]}>
                {i < tab ? <Icon name="check" size={16} color={colors.primary} strokeWidth={2.5} /> : <T style={{ color: i === tab ? '#fff' : colors.grey, fontSize: font.body }}>{i + 1}</T>}
              </View>
              <T style={{ color: i === tab ? colors.primaryDark : colors.grey, fontSize: font.body, fontWeight: i === tab ? '600' : '400' }}>{t.label}</T>
            </Pressable>
          ))}
        </View>

        <View style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingRight: 8, paddingBottom: 16, gap: 14 }}>
            {tab === 0 ? (
              <View style={styles.banner}>
                <Icon name="user" size={50} color={colors.primary} />
                <View>
                  <T style={{ color: colors.primary, fontSize: font.body }}>New Patient</T>
                  <T style={{ fontSize: 22, fontWeight: '600' }}>Patient ID will be generated</T>
                </View>
              </View>
            ) : null}
            {current.sections.map((s) => (
              <View key={s.title} style={{ gap: 12 }}>
                <View style={styles.sectionHead}>
                  <IconCircle name={s.icon} size={36} iconSize={20} />
                  <T style={{ fontSize: font.body, fontWeight: '700' }}>{s.title}</T>
                </View>
                {s.fields.map((f, i) => (Array.isArray(f) ? (
                  <View key={i} style={{ flexDirection: 'row', gap: 26 }}>
                    {f.map((ff) => <Field key={ff.k} f={ff} value={form[ff.k]} error={errors[ff.k]} onChange={(v) => set(ff.k, v)} />)}
                  </View>
                ) : (
                  <Field key={f.k} f={f} value={form[f.k]} error={errors[f.k]} onChange={(v) => set(f.k, v)} />
                )))}
              </View>
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <BackButton onPress={tab === 0 ? goBack : () => setTab(tab - 1)} />
            {errors._save ? <T style={{ color: '#D62828' }}>{errors._save}</T> : null}
            <NextButton label={tab === TABS.length - 1 ? 'Save Patient' : 'Next'} onPress={next} />
          </View>
        </View>
      </View>

      <ConfirmModal
        visible={confirm}
        icon="userPlus"
        title="Save New Patient?"
        subtitle="A patient ID will be generated on the controller"
        rows={[['Name', form.fullName || ''], ['Age / Gender', `${form.age || '—'} / ${form.gender || '—'}`], ['Diagnosis', form.diagnosis || '—']]}
        onCancel={() => setConfirm(false)}
        onConfirm={save}
        busy={busy}
      />
    </Screen>
  );
}

function Field({ f, value, onChange, error }) {
  return (
    <View style={[styles.field, error && { borderColor: '#E57373' }]}>
      <Icon name={f.icon} size={22} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <T style={{ fontSize: font.body }}>
          {f.label}{f.required ? <T style={{ color: '#D62828' }}> *</T> : null}
        </T>
        {f.options ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            {f.options.map((o) => (
              <Pressable key={o} onPress={() => onChange(o)} style={[styles.chip, value === o && styles.chipOn]}>
                <T style={{ fontSize: 13, color: value === o ? '#fff' : colors.primary }}>{o}</T>
              </Pressable>
            ))}
          </View>
        ) : (
          <TextInput
            value={value ?? ''}
            onChangeText={(t) => onChange(f.numeric ? t.replace(/[^0-9.]/g, '') : t)}
            placeholder={f.ph}
            placeholderTextColor="#A5ADA7"
            inputMode={f.numeric ? 'decimal' : 'text'}
            style={styles.fieldInput}
          />
        )}
      </View>
      {error ? <T style={{ color: '#D62828', fontSize: 12 }}>{error}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', paddingHorizontal: 30, paddingTop: 14, gap: 4 },
  tab: { flex: 1, height: 46, backgroundColor: '#CDE8C3', borderTopLeftRadius: 22, borderTopRightRadius: 22, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  tabActive: { backgroundColor: colors.white },
  tabText: { fontSize: font.small, color: '#8FB083' },
  body: { flex: 1, flexDirection: 'row', gap: 16, paddingHorizontal: 30, paddingTop: 12, paddingBottom: 16 },
  stepper: { width: 250, borderWidth: 1, borderColor: colors.greyLight, borderRadius: 14, padding: 18, gap: 8, backgroundColor: 'rgba(255,255,255,0.6)' },
  stepTitle: { fontSize: 22, fontWeight: '700', marginBottom: 14 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, cursor: 'pointer' },
  stepNum: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.greyLight, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 22, backgroundColor: '#EAF3E6', borderColor: '#B9D6AD', borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, height: 92 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: colors.greyLight, borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 18, minHeight: 58, paddingVertical: 6 },
  fieldInput: { fontFamily: font.family, fontSize: 13, color: colors.text, paddingVertical: 2, outlineStyle: 'none' },
  chip: { borderWidth: 1, borderColor: colors.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 3, cursor: 'pointer' },
  chipOn: { backgroundColor: colors.primary },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 },
});
