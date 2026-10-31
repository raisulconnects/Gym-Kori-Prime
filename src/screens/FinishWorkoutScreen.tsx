import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { NumberField } from '../components/NumberField';
import { type ActiveSession, useActiveWorkout } from '../data/hooks';
import { discardWorkout, finishWorkout, isStale, suggestedMinutes } from '../data/workouts';
import { useFormat } from '../preferences/useFormat';
import { clearRestTimer } from '../workout/useRestTimer';

const MAX_MINUTES = 600;

export function FinishWorkoutScreen() {
  const session = useActiveWorkout();
  if (session === undefined) return <main className="flex-1" />;
  if (session === null) return <Navigate to="/today" replace />;
  return <FinishForm key={session.workout.id} session={session} />;
}

function FinishForm({ session }: { session: ActiveSession }) {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const { workout, exercises } = session;
  const [openedAt] = useState(() => new Date());
  const [minutes, setMinutes] = useState(() => String(suggestedMinutes(workout, openedAt)));
  const [note, setNote] = useState(workout.note);
  const [error, setError] = useState(false);
  const forgotten = isStale(workout, openedAt);
  const doneCount = exercises.filter((exercise) => exercise.sets.some((set) => set.done)).length;

  async function save() {
    const value = Number(minutes);
    if (!(value >= 1 && value <= MAX_MINUTES)) {
      setError(true);
      return;
    }
    await finishWorkout(workout, value * 60, note, new Date());
    clearRestTimer();
    navigate('/today', { replace: true });
  }

  async function discard() {
    if (!window.confirm(t('finish.confirmDiscard'))) return;
    await discardWorkout(workout.id);
    clearRestTimer();
    navigate('/today', { replace: true });
  }

  return (
    <main className="flex flex-1 flex-col gap-4 px-5 pt-8 pb-5">
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-bold break-words text-accent">{workout.routineName}</span>
        <h1 className="display text-[42px]">{t('finish.title')}</h1>
      </div>
      {forgotten && (
        <p role="status" className="m-0 text-base font-semibold text-danger">
          {t('finish.forgotten')}
        </p>
      )}
      <section className="card flex flex-col gap-3 p-[18px]">
        <div className="flex flex-col gap-1.5 text-[15px] font-semibold">
          <span aria-hidden="true">{t('finish.duration')}</span>
          <NumberField
            label={t('finish.duration')}
            value={minutes}
            maxLength={3}
            onChange={(value) => {
              setMinutes(value);
              setError(false);
            }}
          />
        </div>
        {error && (
          <p role="alert" className="m-0 text-[15px] font-semibold">
            {t('finish.errorDuration')}
          </p>
        )}
        <span className="text-[15px] text-muted">{t('finish.durationHelp')}</span>
        <span className="text-[17px] font-semibold">
          {t('finish.count', { done: format.number(doneCount), total: format.number(exercises.length) })}
        </span>
      </section>
      <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
        {t('finish.note')}
        <textarea
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="field h-auto resize-none py-3 text-base font-normal"
        />
      </label>
      <button type="button" onClick={save} className="cta">
        {t('finish.save')}
      </button>
      <Link to="/workout" className="flex min-h-11 items-center justify-center font-semibold text-ink no-underline">
        {t('finish.keepGoing')}
      </Link>
      <button
        type="button"
        onClick={discard}
        className="mt-auto min-h-12 border-0 bg-transparent text-base font-bold text-danger"
      >
        {t('finish.discard')}
      </button>
    </main>
  );
}
