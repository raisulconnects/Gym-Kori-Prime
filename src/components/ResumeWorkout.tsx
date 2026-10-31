import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../data/db';
import { isStale } from '../data/workouts';

/**
 * When the app opens on its home screen with a workout still running, goes straight back to it.
 * A forgotten workout goes to the finish screen instead, so its duration gets checked.
 */
export function ResumeWorkout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    if (pathname !== '/' && pathname !== '/today') return;

    void (async () => {
      const running = await db.workouts
        .where('status')
        .equals('active')
        .filter((workout) => !workout.deletedAt)
        .first();
      if (running) navigate(isStale(running, new Date()) ? '/workout/finish' : '/workout', { replace: true });
    })();
  }, [navigate, pathname]);

  return null;
}
