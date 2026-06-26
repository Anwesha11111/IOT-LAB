import { useEffect, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../lib/firebase';

export interface LiveReading {
  // Core vitals
  hr:             number;
  spo2:           number;
  temperature:    number;
  humidity:       number;
  aqi:            number;
  motionMag:      number;
  tilt:           number;
  // ML & risk
  mlClass:        number;   // 0=Relaxed 1=Normal 2=Stress
  riskLevel:      number;   // 0=Normal 1=Warning 2=Critical
  riskLabel:      string;
  // Primary condition (v3)
  conditionCode:  number;
  conditionLabel: string;
  // Derived binary flags (0 | 1)
  fallFlag:       number;
  inactivity:     number;
  tachycardia:    number;
  bradycardia:    number;
  lowSpo2:        number;
  criticalSpo2:   number;
  fever:          number;
  hypothermia:    number;
  heatStress:     number;
  excessMotion:   number;
  sensorError:    number;
  batteryLow:     number;
  batteryPct:     number;
  // AI Health Risk Score 0–100
  healthScore:    number;
  sosActive:      boolean;
  timestamp:      string;
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
        if (snapshot.exists()) setData(snapshot.val() as LiveReading);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => off(liveRef, 'value', unsubscribe);
  }, []);

  return { data, loading, error };
}
