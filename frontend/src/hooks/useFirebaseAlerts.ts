/**
 * useFirebaseAlerts
 * -----------------
 * Reads the `alerts` collection from Firestore (written by the ESP32 firmware
 * whenever riskLevel transitions to Critical or SOS is pressed).
 *
 * Returns alerts ordered newest-first, limited to the last 100 documents.
 */

import { useEffect, useState } from 'react';
import {
  collection, query, orderBy, limit,
  onSnapshot,
} from 'firebase/firestore';
import { store } from '../lib/firebase';

export interface AlertRecord {
  id:        string;
  riskLevel: number;
  riskLabel: string;
  hr:        number;
  spo2:      number;
  aqi:       number;
  mlClass?:  number;
  sosActive: boolean;
  timestamp: string;
}

interface UseFirebaseAlertsResult {
  alerts:  AlertRecord[];
  loading: boolean;
  error:   string | null;
}

export function useFirebaseAlerts(): UseFirebaseAlertsResult {
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
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<AlertRecord, 'id'>),
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
