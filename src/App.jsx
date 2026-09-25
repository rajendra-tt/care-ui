import React from 'react';
import { Stage } from './components/Layout';
import { AppProvider, useApp } from './state/AppState';
import { LoadingOverlay, useDismissBootSplash } from './components/LogoLoader';

import Login from './screens/Login';
import AdminHome from './screens/AdminHome';
import TherapistList from './screens/TherapistList';
import TherapistDetails from './screens/TherapistDetails';
import PatientList from './screens/PatientList';
import AddPatient from './screens/AddPatient';
import PatientDetails from './screens/PatientDetails';
import PatientHome from './screens/PatientHome';
import Vitals from './screens/Vitals';
import DeviceControl from './screens/DeviceControl';
import SessionScreen from './screens/SessionScreen';
import SessionReport from './screens/SessionReport';
import DeviceAdmin from './screens/DeviceAdmin';

const SCREENS = {
  Login,
  AdminHome,
  TherapistList,
  TherapistDetails,
  PatientList,
  AddPatient,
  PatientDetails,
  PatientHome,
  Vitals,
  DeviceControl,
  Session: SessionScreen,
  SessionReport,
  DeviceAdmin,
};

function Router() {
  const { route, user, connected, everConnected } = useApp();
  const Comp = SCREENS[route.name] || Login;
  // Only Device Control polls the device and can lose the link here; the session screen shows a
  // banner instead so its E-stop is never covered.
  const gate = user && route.name === 'DeviceControl' && !connected;
  return (
    <>
      <Comp {...route.params} />
      <LoadingOverlay
        visible={gate}
        message={everConnected ? 'Controller not responding — reconnecting…' : 'Connecting to CARE controller…'}
      />
    </>
  );
}

export default function App() {
  useDismissBootSplash();
  return (
    <AppProvider>
      <Stage>
        <Router />
      </Stage>
    </AppProvider>
  );
}
