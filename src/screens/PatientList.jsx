import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Screen } from '../components/Layout';
import Icon from '../components/Icon';
import { BackButton, IconCircle, PillButton, T } from '../components/ui';
import { useApp } from '../state/AppState';
import LogoLoader from '../components/LogoLoader';
import { api } from '../services/api';
import { colors, font, shadow } from '../theme/tokens';

// Assigned patients as a 3-column card grid (P007 "Select Patient", updated UI flow).
// Tapping a card opens that patient's home page; log out lives in the header menu.
export default function PatientList({ adminView = false }) {
  const { user, navigate, goBack, canGoBack, setPatient } = useApp();
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.listPatients(adminView ? undefined : user?.id)
      .then((list) => alive && setPatients(list))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [user, adminView]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? patients.filter((p) => `${p.fullName} ${p.id}`.toLowerCase().includes(q)) : patients;
  }, [patients, query]);

  const open = (p) => {
    if (adminView) { navigate('PatientDetails', { patient: p }); return; }
    setPatient(p);
    navigate('PatientHome');
  };

  return (
    <Screen title={user?.name}>
      <View style={styles.header}>
        <IconCircle name="users" size={44} iconSize={24} />
        <T style={styles.h1}>{adminView ? 'All Patients' : 'Assigned Patients'}</T>
        <View style={[styles.search, shadow.card]}>
          <Icon name="search" size={18} color={colors.grey} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or patient ID…"
            placeholderTextColor="#A5ADA7"
            style={styles.searchInput}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search">
              <Icon name="close" size={16} color={colors.grey} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.grid}>
        {loading ? (
          <View style={styles.center}><LogoLoader size={70} message="Loading patients…" wordmark={false} /></View>
        ) : null}
        {shown.map((p) => <PatientCard key={p.id} p={p} onPress={() => open(p)} />)}
        {!loading && shown.length === 0 ? (
          <T style={styles.empty}>{error || (query ? 'No patients match your search.' : 'No patients assigned yet.')}</T>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={{ width: 178 }}>{canGoBack ? <BackButton onPress={goBack} /> : null}</View>
        <PillButton label="Add New Patient" icon="userPlus" variant="mint" width={218} height={53} fontSize={font.body} onPress={() => navigate('AddPatient')} />
        <View style={{ width: 178 }} />
      </View>
    </Screen>
  );
}

function PatientCard({ p, onPress }) {
  const rows = [
    ['userSolid', p.gender || 'Gender —'],
    ['calendar', p.age ? `${p.age} yrs` : 'Age —'],
    ['idCard', p.id],
  ];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Patient ${p.fullName}`}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.card,
        shadow.card,
        hovered && styles.cardHover,
        pressed && { transform: [{ scale: 0.98 }], borderColor: colors.primary },
      ]}
    >
      <View style={styles.avatar}>
        <View style={{ marginTop: 18 }}>
          <Icon name="user" size={84} color={colors.primary} strokeWidth={1.6} />
        </View>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <T style={styles.name} numberOfLines={1}>{p.fullName}</T>
        {rows.map(([icon, v]) => (
          <View key={icon} style={styles.row}>
            <Icon name={icon} size={15} color={colors.primary} />
            <T style={styles.rowText} numberOfLines={1}>{v}</T>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 70, paddingTop: 20, paddingBottom: 10 },
  h1: { fontSize: font.primary - 4, fontWeight: '600' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 42, borderRadius: 999, backgroundColor: colors.white, paddingHorizontal: 18, marginLeft: 12 },
  searchInput: { flex: 1, fontFamily: font.family, fontSize: font.small, color: colors.text, outlineStyle: 'none' },
  scroll: { flex: 1, marginBottom: 88 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingHorizontal: 70, paddingTop: 12, paddingBottom: 16 },
  center: { width: '100%', alignItems: 'center', marginTop: 60 },
  card: { width: 356, height: 147, borderRadius: 14, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 18, borderWidth: 1.5, borderColor: 'transparent', cursor: 'pointer' },
  cardHover: { borderColor: colors.mint },
  avatar: { width: 108, height: 108, borderRadius: 54, backgroundColor: '#E3EEE0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  name: { fontSize: 20, fontWeight: '700', color: colors.primaryDark, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { fontSize: font.small, color: colors.primary },
  empty: { width: '100%', textAlign: 'center', color: colors.grey, marginTop: 60, fontSize: font.body },
  footer: { position: 'absolute', left: 60, right: 60, bottom: 26, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
