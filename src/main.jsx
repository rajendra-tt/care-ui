import { AppRegistry } from 'react-native';
import '@fontsource/open-sans/latin-400.css';
import '@fontsource/open-sans/latin-600.css';
import '@fontsource/open-sans/latin-700.css';
import App from './App';
import { installKiosk } from './services/kiosk';

installKiosk(); // kiosk mode: no right-click, dev-tools keys, reload, zoom or leaving via Back

// React Native entry point, rendered to the DOM by react-native-web.
AppRegistry.registerComponent('CareUI', () => App);
AppRegistry.runApplication('CareUI', { rootTag: document.getElementById('root') });
