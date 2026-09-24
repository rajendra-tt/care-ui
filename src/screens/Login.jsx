import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../components/Layout';
import Icon from '../components/Icon';
import { Card, PillButton, T, UnderlineInput } from '../components/ui';
import { LoadingOverlay } from '../components/LogoLoader';
import { useApp } from '../state/AppState';
import { api, isMock } from '../services/api';
import { colors, font } from '../theme/tokens';
import logo from '../assets/charukesi-logo.png';

export default function Login() {
  const { setUser, reset } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!username || !password) { setError('Enter username and password'); return; }
    setBusy(true);
    setError('');
    setShowPassword(false);
    try {
      const user = await api.login(username, password);
      setUser(user);
      reset(user.role === 'admin' ? 'AdminHome' : 'PatientList');
    } catch (e) {
      setError(e.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen showNav={false}>
      <View style={styles.row}>
        <View style={styles.brand}>
          <Image source={logo} style={{ width: 327, height: 285 }} resizeMode="contain" accessibilityLabel="Charukesi" />
          <T style={styles.tagline}>REHABILLITATION. RECOVERY. PRECISION</T>
        </View>
        <Card style={styles.card}>
          <UnderlineInput icon="userSolid" placeholder="Username" value={username} onChangeText={setUsername} autoCapitalize="none" onSubmitEditing={submit} />
          <UnderlineInput
            icon="lock"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            onSubmitEditing={submit}
            style={{ marginTop: 34 }}
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={10}
                style={styles.eye}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} color={showPassword ? colors.primary : '#8C9690'} />
              </Pressable>
            }
          />
          <T style={styles.error}>{error}</T>
          <PillButton
            label={busy ? 'Signing in…' : 'Sign In'}
            iconRight="arrowRight"
            variant="outlineGreen"
            width={275}
            height={49}
            fontSize={font.body}
            onPress={submit}
            disabled={busy}
            style={{ alignSelf: 'center', justifyContent: 'space-between', paddingHorizontal: 40 }}
          />
          {isMock ? <T style={styles.hint}>Simulator logins: preethi / 1234 · admin / admin</T> : null}
        </Card>
      </View>
      <LoadingOverlay visible={busy} message="Signing in…" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 60 },
  brand: { alignItems: 'center', width: 480 },
  tagline: { marginTop: 18, fontSize: font.secondary, letterSpacing: 2.5, color: colors.primaryDark, fontWeight: '600' },
  card: { width: 464, minHeight: 351, borderRadius: 32, paddingHorizontal: 56, paddingTop: 70, paddingBottom: 30 },
  error: { color: '#D62828', fontSize: font.small, minHeight: 20, marginTop: 14, marginBottom: 10, textAlign: 'center' },
  eye: { padding: 4, cursor: 'pointer' },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 22 },
});
