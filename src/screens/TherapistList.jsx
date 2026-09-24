import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Screen } from '../components/Layout';
import Icon from '../components/Icon';
import { BackButton, Card, IconCircle, T, UnderlineInput } from '../components/ui';
import { useApp } from '../state/AppState';
import { api } from '../services/api';
import { colors, font } from '../theme/tokens';

export default function TherapistList() {
  const { user, navigate, goBack } = useApp();
  const [list, setList] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.listTherapists().then(setList).catch((e) => setError(e.message));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? list.filter((t) => t.name.toLowerCase().includes(q)) : list;
  }, [list, query]);

  return (
    <Screen title={user?.name}>
      <View style={styles.wrap}>
        <View style={{ width: 250, alignItems: 'center' }}>
          <Card style={styles.profile}>
            <View style={styles.avatar}><Icon name="user" size={80} color={colors.breakBrown} strokeWidth={1.5} /></View>
            <T style={{ fontSize: font.secondary, fontWeight: '600', marginTop: 16 }}>Therapists</T>
            <UnderlineInput icon="search" placeholder="Search name" value={query} onChangeText={setQuery} style={{ alignSelf: 'stretch', marginTop: 34, borderBottomColor: colors.greyLight }} />
          </Card>
          <BackButton onPress={goBack} style={{ marginTop: 24 }} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.header}>
            <IconCircle name="users" size={65} iconSize={32} />
            <View>
              <T style={{ fontSize: font.primary, fontWeight: '600' }}>All Therapists</T>
              <T style={{ fontSize: font.small, color: colors.grey }}>{error || 'View therapist details and assigned patients'}</T>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12, padding: 4 }}>
            {shown.map((t) => (
              <Pressable key={t.id} onPress={() => navigate('TherapistDetails', { therapist: t })}>
                <Card style={styles.row}>
                  <Icon name="user" size={34} color={colors.breakBrown} />
                  <T style={{ flex: 1, fontSize: 20, color: colors.primaryDark }}>{t.name}</T>
                  <Icon name="chevronRight" size={26} color={colors.primary} />
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, flexDirection: 'row', paddingHorizontal: 24, paddingTop: 14, paddingBottom: 20, gap: 36 },
  profile: { width: 250, height: 560, alignItems: 'center', paddingHorizontal: 20, paddingTop: 34 },
  avatar: { width: 150, height: 150, borderRadius: 75, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 28, paddingLeft: 18, marginBottom: 12 },
  row: { height: 76, flexDirection: 'row', alignItems: 'center', gap: 22, paddingHorizontal: 26, borderRadius: 16 },
});
