/**
 * useVitalsHistory
 * ----------------
 * Accumulates live RTDB readings into an in-memory ring buffer so
 * Recharts can render time-series graphs.
 *
 * Each time /live updates, the new reading is appended to the buffer.
 * Oldest entries are dropped once MAX_POINTS is reached.
 */

import { useEffect, useRef, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../lib/firebase';
import type { LiveReading } from './useFirebaseLive';

export interface HistoryPoint extends LiveReading {
  /** Wall-clock time the reading was received by the browser (ms since epoch) */
  receivedAt: number;
  /** Human-readable HH:MM:SS label for the x-axis */
  timeLabel: string;
}

const MAX_POINTS = 60; // keep the last 60 readings (~90 seconds at 1.5 s/reading)

interface UseVitalsHistoryResult {
  history: HistoryPoint[];
  loading: boolean;
  error:   string | null;
}

function toTimeLabel(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function useVitalsHistory(): UseVitalsHistoryResult {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Use a ref so the onValue callback always closes over the latest buffer
  // without needing to recreate the listener.
  const bufferRef = useRef<HistoryPoint[]>([]);

  useEffect(() => {
    const liveRef = ref(db, '/live');

    const unsubscribe = onValue(
      liveRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const now = Date.now();
          const point: HistoryPoint = {
            ...(snapshot.val() as LiveReading),
            receivedAt: now,
            timeLabel:  toTimeLabel(now),
          };

          const next = [...bufferRef.current, point];
          if (next.length > MAX_POINTS) next.splice(0, next.length - MAX_POINTS);
          bufferRef.current = next;
          setHistory([...next]);
        }
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

  return { history, loading, error };
}
