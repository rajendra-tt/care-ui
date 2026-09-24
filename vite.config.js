import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { LOGO_LOADER_CSS, logoLoaderHtml } from './src/components/logoLoaderMarkup.js';

// Injects the animated-logo boot splash straight into index.html, so it shows while the
// JS bundle is still downloading from the cRIO. The app fades it out once it has mounted.
const bootSplash = () => ({
  name: 'care-boot-splash',
  transformIndexHtml: (html) =>
    html
      .replace('</head>', `<style>${LOGO_LOADER_CSS}</style>\n  </head>`)
      .replace('<div id="root"></div>', `<div id="root"></div>\n    <div id="ck-boot">${logoLoaderHtml({ size: 120, message: 'Starting CARE 2.0…' })}</div>`),
});

// The UI is written with React Native primitives and rendered in the browser
// through react-native-web, then built to static files that the cRIO serves.
export default defineConfig({
  base: './', // relative paths so the bundle works from any folder on the cRIO web server
  plugins: [react(), bootSplash()],
  // Listen on every network interface (0.0.0.0) so a tablet on the same network can open
  // http://<this-PC's-IP>:5173 (dev) or :4173 (built app). Vite prints the Network URLs on start.
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
  resolve: {
    alias: { 'react-native': 'react-native-web' },
    extensions: ['.web.jsx', '.web.js', '.jsx', '.js'],
  },
  define: { __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production') },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 8192,
    chunkSizeWarningLimit: 800,
    target: 'es2019', // older tablet browsers / embedded Chromium
  },
});
