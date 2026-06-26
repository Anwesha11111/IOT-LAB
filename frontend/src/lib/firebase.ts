/**
 * Firebase client configuration
 * --------------------------------
 * Credentials match the values already hard-coded in the ESP32 firmware.
 * In a production app move these to a .env file and prefix with VITE_.
 */

import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            'AIzaSyAybuJhmK6aoIwWNpwPoe_J85trKICxuGY',
  authDomain:        'iot-lab-e8ac7.firebaseapp.com',
  databaseURL:       'https://iot-lab-e8ac7-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:         'iot-lab-e8ac7',
  storageBucket:     'iot-lab-e8ac7.appspot.com',
  messagingSenderId: '439019607398',
  appId:             '1:439019607398:web:edgeguard',
};

// Prevent double-init in HMR / StrictMode
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db    = getDatabase(app);
export const store = getFirestore(app);
