import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../components/Layout';
import Icon from '../components/Icon';
import { LiftControl, MovementControl, OffloadingPanel } from '../components/Controls';
import { BackButton, Card, ConfirmModal, IconCircle, NextButton, PillButton, StatTile, T } from '../components/ui';
import { useApp } from '../state/AppState';
import { bodyWeightKg, describe, fmt, offloadKg, offloadPct } from '../services/offloading';
import { colors, font } from '../theme/tokens';

export const MODES = {
  balance: { label: 'Balance', title: 'Balance Mode', icon: 'balance' },
  squat: { label: 'Squat', title: 'Squatting Mode', icon: 'squat' },
  walk: { label: 'Walk', title: 'Walking Mode', icon: 'walk' },
};
const SPEEDS = [['slow', 'Slow', -55], ['medium', 'Medium', 0], ['fast', 'Fast', 55]];

export const fmtDuration = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
};

export default function SessionScreen({ preset }) {
  const { user, patient, telemetry: tm, sendCommand, goBack, replace, vitalsBefore, connected } = useApp();
  const weight = bodyWeightKg(vitalsBefore, patient);
  const [mode, setMode] = useState(tm.mode || preset || null);
  const [speed, setSpeed] = useState(tm.speed || 'slow');
  const [modal, setModal] = useState(null); // 'start' | 'break' | 'resume' | 'end' | 'estop'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const startedAt = useRef(null);
  const lastActive = useRef('idle'); // state before an e-stop

  const state = tm.state; // idle | running | break | estop
  if (state !== 'estop') lastActive.current = state;
  const sessionActive = state === 'running' || state === 'break' || (state === 'estop' && lastActive.current !== 'idle');
  const running = state === 'running';
  const controlsLocked = running || state === 'estop';

  // Controller entered e-stop (from this UI or a hardware button): show the pop-up.
  useEffect(() => {
    if (state === 'estop') setModal('estop');
    else if (modal === 'estop') setModal(null);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); setModal(null); } catch (e) { setError(e.message || 'Command failed'); } finally { setBusy(false); }
  };

  const chooseMode = (m) => {
    if (controlsLocked) return;
    setMode(m);
    sendCommand({ cmd: 'mode', mode: m, speed }).catch(() => {});
  };
  const chooseSpeed = (s) => {
    if (controlsLocked) return;
    setSpeed(s);
    sendCommand({ cmd: 'mode', mode: 'walk', speed: s }).catch(() => {});
  };

  const eStop = () => {
    // Stop first, ask questions later: the command goes out before any pop-up.
    sendCommand({ cmd: 'estop', action: 'engage' }).catch(() => setError('E-STOP COMMAND NOT ACKNOWLEDGED — use the hardware E-stop'));
    setModal('estop');
  };

  const finish = () =>
    run(async () => {
      await sendCommand({ cmd: 'session', action: 'stop' });
      replace('SessionReport', {
        stats: { ...tm, mode: mode || tm.mode, speed, bodyWeightKg: weight, offloadKg: liveKg },
        startedAt: startedAt.current,
        endedAt: new Date().toISOString(),
        vitalsBefore,
      });
    });

  const title = mode ? MODES[mode].title : 'Select Mode';
  const unit = tm.offloadUnit === 'kg' ? 'kg' : 'percent';
  const offloadText = describe(tm.offloading, unit, weight); // e.g. "25 % (18 kg)"
  const liveKg = offloadKg(tm.offloading, unit, weight);
  const livePct = offloadPct(tm.offloading, unit, weight);
  const settingRows = [['Mode', mode ? MODES[mode].title : '—'], ...(mode === 'walk' ? [['Speed', speed[0].toUpperCase() + speed.slice(1)]] : []), ['Offloading', offloadText]];

  return (
    <Screen title={user?.name} subtitle={patient?.fullName} lockNav={sessionActive}>
      {/* ---- top row ---- */}
      <View style={styles.top}>
        <Card style={styles.durCard}>
          <IconCircle name="alarm" size={46} iconSize={24} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T style={{ fontSize: font.small, color: colors.grey }}>Session Duration</T>
            <T style={{ fontSize: font.primary, fontWeight: '700' }}>{sessionActive ? fmtDuration(tm.durationSec) : '--:--'}</T>
          </View>
        </Card>
        <View style={styles.titleWrap}>
          {mode ? <Icon name={MODES[mode].icon} size={42} color={colors.primary} /> : null}
          <T style={styles.title}>{title}</T>
          {state === 'break' ? <View style={styles.badge}><T style={styles.badgeText}>ON BREAK</T></View> : null}
        </View>
        <View style={{ width: 380 }} />
      </View>

      {!connected ? (
        <View style={styles.linkLost}>
          <T style={styles.linkLostText}>Controller not responding — values may be stale. Use the hardware E-stop if needed.</T>
        </View>
      ) : null}

      {/* ---- middle ---- */}
      <View style={styles.mid}>
        {running ? (
          <View style={styles.stats}>
            <View style={styles.statRow}>
              <StatTile big icon="fall" label="No. of fall arrest" value={tm.fallArrests} width={257} height={214} />
              <StatTile big icon="cup" label="No. of Breaks" value={tm.breaks} width={257} height={214} />
              <StatTile
                big
                icon="person"
                label={liveKg != null ? `Current offloading · ${fmt(livePct)} %` : 'Current offloading'}
                value={liveKg != null ? `${fmt(liveKg, 1)} kg` : offloadText}
                width={257}
                height={214}
              />
            </View>
            <View style={styles.statRow}>
              <StatTile icon="squat" label="No. of Squats" value={mode === 'squat' ? tm.squats : '---'} width={188} height={214} />
              <StatTile icon="steps" label="No. of Steps" value={mode === 'walk' ? tm.steps : '---'} width={188} height={214} />
              <StatTile icon="speed" label="Speed (m/s)" value={mode === 'walk' ? tm.speedMps.toFixed(2) : '---'} width={188} height={214} />
              <StatTile icon="distance" label="Distance travelled" value={mode === 'walk' ? `${tm.distanceM.toFixed(1)} m` : '---'} width={188} height={214} />
            </View>
          </View>
        ) : (
          <>
            <Card style={styles.leftCard}>
              <LiftControl disabled={controlsLocked} size={62} />
              <View style={styles.hr} />
              <MovementControl disabled={controlsLocked} size={56} />
            </Card>
            <Card style={styles.modeCard}>
              {Object.entries(MODES).map(([k, m]) => (
                <Pressable key={k} onPress={() => chooseMode(k)} disabled={controlsLocked} style={({ pressed }) => [styles.modeBtn, mode === k && styles.modeOn, pressed && { transform: [{ scale: 0.98 }] }]}>
                  <Icon name={m.icon} size={32} color={colors.primaryDark} />
                  <T style={styles.modeText}>{m.label}</T>
                </Pressable>
              ))}
              {mode === 'walk' ? (
                <View style={styles.speeds}>
                  {SPEEDS.map(([k, l, ang], i) => (
                    <Pressable key={k} onPress={() => chooseSpeed(k)} style={{ alignItems: 'center', gap: 8 }}>
                      <SpeedGauge angle={ang} level={i} on={speed === k} />
                      <View style={[styles.speedPill, speed === k && styles.speedOn]}>
                        <T style={{ fontSize: font.small, fontWeight: '600', color: speed === k ? '#fff' : colors.primaryDark }}>{l}</T>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <T style={styles.modeHint}>{mode ? 'Adjust offloading, then Start Exercise.' : 'Choose an exercise mode to begin.'}</T>
              )}
            </Card>
          </>
        )}
        <OffloadingPanel style={styles.offCard} disabled={state === 'estop'} />
      </View>

      {/* ---- bottom ---- */}
      <View style={styles.bottom}>
        {state === 'idle' || (state === 'estop' && !sessionActive) ? (
          <>
            <BackButton onPress={goBack} />
            <T style={styles.error}>{error}</T>
            <NextButton label="Start Exercise" disabled={!mode || state === 'estop'} onPress={() => setModal('start')} />
          </>
        ) : (
          <>
            <View style={{ width: 178 }} />
            <T style={styles.error}>{error}</T>
            {state === 'break' ? (
              // Ending a session is only offered from the break screen, never while it is running.
              <View style={{ flexDirection: 'row', gap: 40 }}>
                <PillButton label="Resume Session" variant="resume" width={195} height={53} onPress={() => setModal('resume')} />
                <PillButton label="End session" icon="endSession" variant="dark" width={197} height={57} onPress={() => setModal('end')} />
              </View>
            ) : (
              <View style={{ width: 400, alignItems: 'center' }}>
                <PillButton label="Break" icon="cup" variant="break" width={197} height={57} onPress={() => setModal('break')} disabled={state !== 'running'} />
              </View>
            )}
          </>
        )}
      </View>

      {/* E-stop is drawn after (and above) every pop-up so it is never covered. It fires on
          press-in, not on release, so a hurried tap cannot be lost. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Emergency stop"
        delayPressIn={0}
        onPressIn={eStop}
        style={({ pressed }) => [styles.estop, pressed && { transform: [{ scale: 0.97 }] }]}
      >
        <View style={styles.estopSquare} />
        <T style={styles.estopText}>{state === 'estop' ? 'E-stop engaged' : 'Emergency stop'}</T>
      </Pressable>

      {/* ---- pop-ups ---- */}
      <ConfirmModal
        visible={modal === 'start'}
        icon={mode ? MODES[mode].icon : 'check'}
        title="Confirm Mode"
        subtitle="You are about to start the session with the following settings"
        rows={settingRows}
        busy={busy}
        onCancel={() => setModal(null)}
        onConfirm={() => run(async () => {
          await sendCommand({ cmd: 'mode', mode, speed });
          await sendCommand({ cmd: 'session', action: 'start' });
          startedAt.current = new Date().toISOString();
        })}
      />
      <ConfirmModal
        visible={modal === 'break'}
        icon="cup"
        iconBg={colors.breakBrown}
        iconColor="#fff"
        title="Do you want a break?"
        subtitle="The session timer pauses and the device holds the patient in place"
        rows={settingRows}
        busy={busy}
        onCancel={() => setModal(null)}
        onConfirm={() => run(() => sendCommand({ cmd: 'session', action: 'break' }))}
      />
      <ConfirmModal
        visible={modal === 'resume'}
        icon="play"
        title="RESUME SESSION?"
        subtitle="You are about to resume the session with the following settings"
        rows={settingRows}
        busy={busy}
        onCancel={() => setModal(null)}
        onConfirm={() => run(async () => {
          if (mode) await sendCommand({ cmd: 'mode', mode, speed });
          await sendCommand({ cmd: 'session', action: 'resume' });
        })}
      />
      <ConfirmModal
        visible={modal === 'end'}
        icon={mode ? MODES[mode].icon : 'endSession'}
        title="END SESSION?"
        subtitle="You are about to end the session with the following settings"
        rows={[...settingRows, ['Duration', fmtDuration(tm.durationSec)]]}
        busy={busy}
        onCancel={() => setModal(null)}
        onConfirm={finish}
      />
      <ConfirmModal
        visible={modal === 'estop'}
        icon="stop"
        iconBg={colors.danger}
        iconColor="#fff"
        title="EMERGENCY STOP"
        subtitle={state === 'estop' ? 'All device motion has been halted' : 'Sending stop command…'}
        rows={[]}
        busy={busy}
        // During a session the only way out is Release -> break screen (Resume / End session there).
        hideCancel={sessionActive}
        cancelLabel="Back"
        confirmLabel="Release E-stop"
        confirmIcon="check"
        onCancel={() => run(async () => { await sendCommand({ cmd: 'estop', action: 'release' }); goBack(); })}
        onConfirm={() => run(() => sendCommand({ cmd: 'estop', action: 'release' }))}
      >
        <T style={{ fontSize: font.body, fontWeight: '600' }}>To check before confirming:</T>
        <T style={styles.check}>•  Patient is secure in the harness and not bearing unexpected load</T>
        <T style={styles.check}>•  Area around the device is clear</T>
        <T style={styles.check}>•  Cause of the stop has been identified</T>
        <T style={[styles.check, { color: colors.grey }]}>
          {sessionActive
            ? 'Releasing returns to the break screen. Resume or end the session from there; it never restarts automatically.'
            : 'Releasing re-enables the device controls.'}
        </T>
      </ConfirmModal>
    </Screen>
  );
}

function SpeedGauge({ angle, level, on }) {
  const shades = ['#C9E3BD', '#8DBF78', colors.primary];
  return (
    <svg width="60" height="46" viewBox="0 0 60 46" aria-hidden="true">
      <path d="M8 40 A 22 22 0 0 1 52 40" stroke="#D9D9D9" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d={level === 0 ? 'M8 40 A 22 22 0 0 1 22 20' : level === 1 ? 'M8 40 A 22 22 0 0 1 40 21' : 'M8 40 A 22 22 0 0 1 52 40'} stroke={shades[level]} strokeWidth="6" fill="none" strokeLinecap="round" opacity={on ? 1 : 0.7} />
      <g transform={`rotate(${angle} 30 40)`}>
        <path d="M30 40 L30 22" stroke={colors.primaryDark} strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <circle cx="30" cy="40" r="2.5" fill={colors.primaryDark} />
    </svg>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 36, paddingTop: 20, height: 118 },
  durCard: { width: 353, height: 74, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 32, fontWeight: '600' },
  badge: { backgroundColor: colors.resumeOrange, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  estop: { position: 'absolute', right: 36, top: 20, zIndex: 60, width: 380, height: 92, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, cursor: 'pointer', backgroundImage: 'linear-gradient(180deg, #FF5A1F 0%, #FF0000 45%, #F00000 100%)', boxShadow: '0 6px 16px rgba(255,0,0,0.35)' },
  estopSquare: { width: 22, height: 22, backgroundColor: '#fff', borderRadius: 3 },
  estopText: { color: '#fff', fontSize: font.primary, fontWeight: '600' },
  mid: { flexDirection: 'row', paddingHorizontal: 36, gap: 22, height: 450, marginTop: 14 },
  leftCard: { width: 370, paddingTop: 14, paddingBottom: 10, alignItems: 'center' },
  hr: { alignSelf: 'stretch', height: 1, backgroundColor: colors.line, marginVertical: 8, marginHorizontal: 24 },
  modeCard: { width: 400, paddingTop: 26, paddingHorizontal: 22, alignItems: 'center', gap: 18 },
  modeBtn: { width: 340, height: 64, borderRadius: 999, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, cursor: 'pointer', boxShadow: '0 3px 9px rgba(37,66,41,0.16)' },
  modeOn: { backgroundColor: colors.selectedMode, boxShadow: '0 0 0 3px #fff, 0 3px 12px rgba(37,66,41,0.22)' },
  modeText: { fontSize: font.secondary + 2, fontWeight: '700' },
  modeHint: { color: colors.grey, fontSize: font.small, marginTop: 30, textAlign: 'center' },
  speeds: { flexDirection: 'row', gap: 22, marginTop: 10 },
  speedPill: { width: 95, height: 31, borderRadius: 999, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.14)' },
  speedOn: { backgroundColor: colors.primary },
  offCard: { width: 400, height: 450 },
  stats: { width: 792, gap: 22 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  bottom: { position: 'absolute', left: 60, right: 36, bottom: 26, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  linkLost: { position: 'absolute', left: 36, right: 440, top: 96, zIndex: 55, backgroundColor: '#D62828', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 14 },
  linkLostText: { color: '#fff', fontSize: font.small, fontWeight: '700' },
  error: { color: '#D62828', fontSize: font.body, fontWeight: '600' },
  check: { fontSize: font.small, color: colors.text },
});
