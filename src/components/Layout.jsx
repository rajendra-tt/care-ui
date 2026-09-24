import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Icon, { Battery } from './Icon';
import { T } from './ui';
import { useApp } from '../state/AppState';
import { isMock } from '../services/api';
import { toggleFullscreen, useAutoFullscreen, useFullscreenState } from '../services/fullscreen';
import { SCREEN, colors, font, shadow } from '../theme/tokens';
import logoMark from '../assets/charukesi-mark.png';

const isEditable = (el) =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

// Window size used for scaling, ignoring the on-screen keyboard.
// Some tablet browsers (older Chrome, Samsung Internet, WebView kiosks) shrink the window
// height when the keyboard opens; scaling to that height would shrink the whole UI. If the
// height drops while a text field is focused and the width is unchanged, it is the keyboard:
// keep the previous height. A width change (rotation, window resize) always re-fits.
function useStableViewport() {
  const { width, height } = useWindowDimensions();
  const stable = useRef({ width, height });
  const s = stable.current;
  const editing = typeof document !== 'undefined' && isEditable(document.activeElement);
  if (width !== s.width || height >= s.height || !editing) stable.current = { width, height };
  return { width, height: stable.current.height };
}

// Keeps the focused field above the keyboard when the browser shrank the window
// (with interactive-widget=resizes-visual the browser pans to the field by itself).
function useKeepFocusedFieldVisible() {
  useEffect(() => {
    let timer;
    const reveal = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const el = document.activeElement;
        if (!isEditable(el)) return;
        const r = el.getBoundingClientRect();
        const visibleH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        if (r.top < 8 || r.bottom > visibleH - 8) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 350); // after the keyboard animation has resized the window
    };
    const onFocus = (e) => { if (isEditable(e.target)) reveal(); };
    document.addEventListener('focusin', onFocus);
    window.addEventListener('resize', reveal);
    window.visualViewport?.addEventListener('resize', reveal);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusin', onFocus);
      window.removeEventListener('resize', reveal);
      window.visualViewport?.removeEventListener('resize', reveal);
    };
  }, []);
}

// Fixed 1280x800 design canvas, scaled uniformly to whatever display the cRIO UI is opened on.
export function Stage({ children }) {
  const { width, height } = useStableViewport();
  useKeepFocusedFieldVisible();
  useAutoFullscreen();
  const scale = Math.min(width / SCREEN.width, height / SCREEN.height);
  return (
    // The outer layer only scrolls while the keyboard covers part of a shrunken window.
    <View style={styles.stageOuter}>
      <View style={[styles.stageFrame, { height }]}>
        <View style={{ width: SCREEN.width * scale, height: SCREEN.height * scale, overflow: 'hidden' }}>
          <View style={[styles.canvas, { transform: [{ scale }], transformOrigin: 'top left' }]}>{children}</View>
        </View>
      </View>
    </View>
  );
}

// Soft green waves in the lower-left corner seen on every mock-up.
export function Waves() {
  return (
    <svg width="1280" height="800" viewBox="0 0 1280 800" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} aria-hidden="true">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#F7FAF5" />
          <stop offset="1" stopColor="#EEF4EC" />
        </linearGradient>
        <linearGradient id="w1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9CC7AE" stopOpacity="0.55" />
          <stop offset="1" stopColor="#DDEDE2" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="w2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#B9DAC5" stopOpacity="0.6" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1280" height="800" fill="url(#bg)" />
      <path d="M0 520 C 220 600 420 700 820 800 L0 800 Z" fill="url(#w1)" />
      <path d="M0 610 C 260 640 520 720 1100 800 L0 800 Z" fill="url(#w2)" />
      <path d="M0 470 C 240 560 520 690 980 800" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="2" fill="none" />
      <path d="M0 560 C 300 620 600 720 1180 800" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.5" fill="none" />
      <path d="M0 680 C 260 700 560 750 800 800" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function TopBar({ title, subtitle, showNav = true, lockNav = false }) {
  const { user, connected, telemetry, logout, reset } = useApp();
  const [menu, setMenu] = useState(false);
  const home = () => {
    if (lockNav || !user) return;
    reset(user.role === 'admin' ? 'AdminHome' : 'PatientList');
  };
  const fs = useFullscreenState();
  const fsLabel = fs.active ? 'Exit full screen' : 'Full screen';
  const fullscreen = () => {
    setMenu(false);
    toggleFullscreen();
  };
  return (
    <View style={styles.bar}>
      <View style={styles.barSide}>
        {showNav ? <Image source={logoMark} style={{ width: 43, height: 56 }} resizeMode="contain" accessibilityLabel="Charukesi" /> : null}
      </View>
      <View style={styles.barCenter}>
        {title ? <T style={styles.barTitle}>{title}</T> : null}
        {subtitle ? <T style={styles.barTitle}>{subtitle}</T> : null}
      </View>
      <View style={[styles.barSide, styles.barIcons]}>
        {isMock ? <T style={styles.mock}>SIMULATOR</T> : null}
        {fs.supported ? (
          <Pressable onPress={toggleFullscreen} accessibilityRole="button" accessibilityLabel={fsLabel} hitSlop={8}>
            <Icon name={fs.active ? 'exitFullscreen' : 'fullscreen'} size={24} color="#fff" strokeWidth={2.2} />
          </Pressable>
        ) : null}
        {showNav ? (
          <>
            <Pressable onPress={() => setMenu((m) => !m)} accessibilityLabel="Menu" disabled={!user}>
              <Icon name="menu" size={26} color="#fff" strokeWidth={2.2} />
            </Pressable>
            <Pressable onPress={home} accessibilityLabel="Home" disabled={lockNav} style={{ opacity: lockNav ? 0.4 : 1 }}>
              <Icon name="home" size={25} color="#fff" strokeWidth={2.2} />
            </Pressable>
          </>
        ) : null}
        <Icon name={connected || !user ? 'wifi' : 'wifiOff'} size={25} color="#fff" strokeWidth={2.2} />
        <Battery level={telemetry.battery} />
      </View>
      {menu ? (
        <View style={[styles.menu, shadow.modal]}>
          {fs.supported ? <MenuItem icon={fs.active ? 'exitFullscreen' : 'fullscreen'} label={fsLabel} onPress={fullscreen} /> : null}
          <MenuItem
            icon="logout"
            label="Log out"
            disabled={lockNav}
            onPress={() => { setMenu(false); logout(); }}
          />
        </View>
      ) : null}
    </View>
  );
}

const MenuItem = ({ icon, label, onPress, disabled }) => (
  <Pressable onPress={onPress} disabled={disabled} style={({ hovered }) => [styles.menuItem, hovered && { backgroundColor: colors.mintLight }, disabled && { opacity: 0.4 }]}>
    <Icon name={icon} size={20} color={colors.primaryDark} />
    <T style={{ fontSize: font.body }}>{label}</T>
  </Pressable>
);

// Standard screen: waves background + header + content area below it.
export function Screen({ title, subtitle, showNav, lockNav, children, contentStyle }) {
  return (
    <View style={styles.screen}>
      <Waves />
      <TopBar title={title} subtitle={subtitle} showNav={showNav} lockNav={lockNav} />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  stageOuter: { flex: 1, overflowX: 'hidden', overflowY: 'auto', backgroundColor: '#1b2e1d' },
  stageFrame: { width: '100%', flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  canvas: { position: 'absolute', left: 0, top: 0, width: SCREEN.width, height: SCREEN.height, backgroundColor: colors.white, overflow: 'hidden' },
  screen: { width: SCREEN.width, height: SCREEN.height },
  bar: { height: SCREEN.headerHeight, backgroundColor: colors.primaryDark, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 36, zIndex: 40 },
  barSide: { width: 300, flexDirection: 'row', alignItems: 'center' },
  barCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  barTitle: { color: colors.white, fontSize: font.secondary, fontWeight: '600', lineHeight: 25 },
  barIcons: { justifyContent: 'flex-end', gap: 16 },
  mock: { color: '#FFD479', fontSize: 11, fontWeight: '700', letterSpacing: 1, borderWidth: 1, borderColor: '#FFD479', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  menu: { position: 'absolute', right: 110, top: 62, backgroundColor: colors.white, borderRadius: 12, paddingVertical: 6, width: 200 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, cursor: 'pointer' },
  content: { flex: 1, position: 'relative' },
});
