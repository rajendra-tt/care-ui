import { AppRegistry } from 'react-native';
import '@fontsource/open-sans/latin-400.css';
import '@fontsource/open-sans/latin-600.css';
import '@fontsource/open-sans/latin-700.css';
import App from './App';

// React Native entry point, rendered to the DOM by react-native-web.
AppRegistry.registerComponent('CareUI', () => App);
AppRegistry.runApplication('CareUI', { rootTag: document.getElementById('root') });
