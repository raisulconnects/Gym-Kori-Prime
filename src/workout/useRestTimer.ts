import { useCallback, useEffect, useState } from 'react';
import { playRestAlert, prepareAlertSound } from './restAlert';

const STORAGE_KEY = 'gym-kori:rest-ends-at';
const REST_MS = 90_000;
const ADD_MS = 30_000;
const ENDED_MESSAGE_MS = 5_000;
const CHECK_EVERY_MS = 250;

function loadEndsAt(): number | null {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return saved > 0 ? saved : null;
  } catch {
    return null;
  }
}

function saveEndsAt(endsAt: number | null) {
  try {
    if (endsAt === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(endsAt));
  } catch {
    // Storage can be blocked in private browsing. The timer still runs until the page closes.
  }
}

/** Stops the rest timer, for when a workout ends. */
export function clearRestTimer() {
  saveEndsAt(null);
}

/**
 * Counts down to a fixed end time rather than counting ticks, so the time stays right when
 * the phone slows the page down or someone switches apps and comes back.
 */
export function useRestTimer() {
  const [endsAt, setEndsAtState] = useState(loadEndsAt);
  const [now, setNow] = useState(() => Date.now());
  const [justEnded, setJustEnded] = useState(false);

  const setEndsAt = useCallback((value: number | null) => {
    saveEndsAt(value);
    setEndsAtState(value);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (endsAt === null) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) {
        setEndsAt(null);
        setJustEnded(true);
        playRestAlert();
      }
    }, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [endsAt, setEndsAt]);

  useEffect(() => {
    if (!justEnded) return;
    const timer = setTimeout(() => setJustEnded(false), ENDED_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [justEnded]);

  return {
    remainingSeconds: endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000)),
    justEnded,
    start: () => {
      prepareAlertSound();
      setJustEnded(false);
      setEndsAt(Date.now() + REST_MS);
    },
    addTime: () => {
      if (endsAt !== null) setEndsAt(endsAt + ADD_MS);
    },
    skip: () => setEndsAt(null),
  };
}
