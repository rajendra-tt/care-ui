import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LOGO_LOADER_CSS, logoLoaderHtml } from './logoLoaderMarkup';

// The boot splash already put the CSS in <head> (built app); in dev or if it was removed,
// add it once so the component is self-contained.
function ensureCss() {
  if (typeof document === 'undefined' || document.getElementById('ck-loader-css')) return;
  if ([...document.querySelectorAll('style')].some((s) => s.textContent.includes('.ck-loader{'))) return;
  const el = document.createElement('style');
  el.id = 'ck-loader-css';
  el.textContent = LOGO_LOADER_CSS;
  document.head.appendChild(el);
}

// Animated Charukesi logo. Plain HTML/SVG inside the React Native tree.
export default function LogoLoader({ size = 110, message, wordmark = true }) {
  ensureCss();
  return <div dangerouslySetInnerHTML={{ __html: logoLoaderHtml({ size, message, wordmark }) }} />;
}

// Full-canvas overlay used while signing in, connecting to the controller or saving.
// Never used on the session screen: it would cover the Emergency stop button.
export function LoadingOverlay({ visible = true, message, size = 110 }) {
  if (!visible) return null;
  return (
    <View style={styles.overlay} accessibilityRole="progressbar">
      <LogoLoader size={size} message={message} />
    </View>
  );
}

// Fades out the pre-JS boot splash from index.html once the first screen has rendered,
// letting at least one full logo cycle play so it does not just flash on a fast network.
export function useDismissBootSplash(minVisibleMs = 1400) {
  useEffect(() => {
    const el = document.getElementById('ck-boot');
    if (!el) return undefined;
    const shownFor = performance.now();
    const wait = Math.max(0, minVisibleMs - shownFor);
    const t1 = setTimeout(() => el.classList.add('ck-hide'), wait);
    const t2 = setTimeout(() => el.remove(), wait + 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [minVisibleMs]);
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 80,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.86)', backdropFilter: 'blur(4px)',
  },
});
