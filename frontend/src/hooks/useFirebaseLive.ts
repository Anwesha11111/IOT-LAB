/**
 * useFirebaseLive
 * ---------------
 * Subscribes to the /live node in Firebase RTDB and returns the latest
 * sensor reading.  The subscription is cleaned up automatically when the
 * component that calls this hook unmounts.
 *
 * Shape of /live (written by the ESP32 firmware):
 *   hr, spo2, temperature, humidity, aqi, motionMag, tilt,
 *   fallFlag, mlClass, riskLevel, riskLabel, sosActive, timestamp
 */

import { useEffect, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../lib/firebase';

export interface LiveReading {
  hr:          number;
  spo2:        number;
  temperature: number;
  humidity:    number;
  aqi:         number;
  motionMag:   number;
  tilt:        number;
  fallFlag:    number;   // 0 | 1
  mlClass:     number;   // 0=Relaxed 1=Normal 2=Stress
  riskLevel:   number;   // 0=Normal 1=Warning 2=Critical
  riskLabel:   string;   // "Normal" | "Warning" | "Critical"
  sosActive:   boolean;
  timestamp:   string;
}

interface UseFirebaseLiveResult {
  data:    LiveReading | null;
  loading: boolean;
  error:   string | null;
}

export function useFirebaseLive(): UseFirebaseLiveResult {
  const [data,    setData]    = useState<LiveReading | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const liveRef = ref(db, '/live');

    const unsubscribe = onValue(
      liveRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData(snapshot.val() as LiveReading);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    // Cleanup: detach listener on unmount
    return () => off(liveRef, 'value', unsubscribe);
  }, []);

  return { data, loading, error };
}
