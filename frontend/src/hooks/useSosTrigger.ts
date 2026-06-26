/**
 * useSosTrigger
 * -------------
 * Writes sosTrigger=true to /command/sosTrigger in Firebase RTDB.
 * The ESP32 reads this flag on every loop iteration, ORs it with
 * the physical SOS button, then clears it by writing false.
 *
 * Returns:
 *   trigger()  — call to fire the SOS
 *   sending    — true while the write is in flight
 *   error      — string if the write failed, null otherwise
 */

import { useState, useCallback } from 'react';
import { ref, set } from 'firebase/database';
import { db } from '../lib/firebase';

interface UseSosTriggerResult {
  trigger: () => Promise<void>;
  sending: boolean;
  error:   string | null;
}

export function useSosTrigger(): UseSosTriggerResult {
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const trigger = useCallback(async () => {
    setSending(true);
    setError(null);
    try {
      await set(ref(db, '/command/sosTrigger'), true);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to send SOS');
    } finally {
      setSending(false);
    }
  }, []);

  return { trigger, sending, error };
}
