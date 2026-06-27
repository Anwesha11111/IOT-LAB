import { useEffect, useState } from 'react';
import {
  collection, query, orderBy, limit, onSnapshot,
} from 'firebase/firestore';
import { store } from '../lib/firebase';

export interface AlertRecord {
  id:             string;
  riskLevel:      number;
  riskLabel:      string;
  conditionCode:  number;
  conditionLabel: string;
  hr:             number;
  spo2:           number;
  temperature:    number;
  aqi:            number;
  mlClass:        number;
  healthScore:    number;
  fallFlag:       number;
  sosActive:      boolean;
  timestamp:      any;   // kept as `any` — formatTs handles all shapes
}

/** Coerce a Firestore value to a safe number, returning fallback if invalid. */
function toNum(v: any, fallback = 0): number {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'number' && isFinite(v)) return v;
  const n = Number(v);
  return isFinite(n) ? n : fallback;
}

/** Coerce to a safe string. */
function toStr(v: any, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') return v;
  // Firestore Timestamp object
  if (typeof v === 'object' && 'seconds' in v) {
    return new Date((v.seconds as number) * 1000).toLocaleString();
  }
  return String(v);
}

/** Sanitize a raw Firestore document into a safe AlertRecord. */
function sanitize(id: string, raw: Record<string, any>): AlertRecord {
  return {
    id,
    riskLevel:      toNum(raw.riskLevel, 0),
    riskLabel:      toStr(raw.riskLabel, 'Normal'),
    conditionCode:  toNum(raw.conditionCode, 0),
    conditionLabel: toStr(raw.conditionLabel, 'Normal'),
    hr:             toNum(raw.hr, 0),
    spo2:           toNum(raw.spo2, 0),
    temperature:    toNum(raw.temperature, 0),
    aqi:            toNum(raw.aqi, 0),
    mlClass:        toNum(raw.mlClass, 1),
    healthScore:    toNum(raw.healthScore, 0),
    fallFlag:       toNum(raw.fallFlag, 0),
    sosActive:      raw.sosActive === true,
    timestamp:      raw.timestamp ?? '—',
  };
}

interface UseAlertsResult {
  alerts:  AlertRecord[];
  loading: boolean;
  error:   string | null;
}

export function useAlerts(): UseAlertsResult {
  const [alerts,  setAlerts]  = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(store, 'alerts'),
      orderBy('timestamp', 'desc'),
      limit(100),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) =>
          sanitize(d.id, d.data() as Record<string, any>)
        );
        setAlerts(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  return { alerts, loading, error };
}
