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
  timestamp:      string;
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
        const docs = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AlertRecord, 'id'>),
        }));
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
