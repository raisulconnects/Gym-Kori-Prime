import { Check, ChevronLeft } from 'lucide-react';
import { RecordBadge } from '../components/Records';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { WorkoutSet } from '../data/db';
import { useExercises, useWorkoutDetail } from '../data/hooks';
import { formatWeight } from '../lib/units';
import { usePreferences } from '../preferences/PreferencesContext';
import { useFormat } from '../preferences/useFormat';

function useSetText() {
  const { t } = useTranslation();
  const { unit } = usePreferences();
  const format = useFormat();
  return (set: WorkoutSet) => {
    const reps = set.reps === null ? '–' : format.number(set.reps);
    if (set.weightKg === null) return t('detail.repsOnly', { reps });
    return t('detail.weightAndReps', {
      weight: format.number(formatWeight(set.weightKg, unit)),
      unit: t(`units.${unit}`),
      reps,
    });
  };
}

export function WorkoutDetailScreen() {
  const { t } = useTranslation();
  const format = useFormat();
  const { workoutId = '' } = useParams();
  const detail = useWorkoutDetail(workoutId);
  const exercises = useExercises();
  const setText = useSetText();

  if (detail === undefined || !exercises) return <main className="flex-1" />;
  if (detail === null) return <Navigate to="/history" replace />;

  const { workout } = detail;
  // Noon avoids the date shifting when read in another time zone.
  const date = new Date(`${workout.localDate}T12:00:00`);

  return (
    <>
      <header className="px-2 pt-2.5 pb-0.5">
        <Link to="/history" className="flex min-h-11 w-fit items-center gap-0.5 px-2 font-semibold text-ink no-underline">
          <ChevronLeft aria-hidden="true" size={20} strokeWidth={2.5} />
          {t('nav.history')}
        </Link>
      </header>
      <main className="flex flex-1 flex-col gap-3 px-4 pb-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="display text-[34px] break-words">{workout.routineName}</h1>
          <span className="text-base text-muted">
            {format.date(date)} ·{' '}
            {t('history.minutes', { minutes: format.number(Math.round((workout.durationSeconds ?? 0) / 60)) })}
          </span>
        </div>
        {workout.note && (
          <p className="m-0 text-base leading-normal break-words whitespace-pre-wrap">{workout.note}</p>
        )}
        {detail.exercises.map((exercise) => {
          const name = exercises.find((option) => option.id === exercise.exerciseId)?.name ?? '';
          return (
            <section key={exercise.id} className="card flex flex-col gap-1.5 px-3.5 py-3">
              <div className="flex items-start justify-between gap-2">
                <h2 lang="en" className="display text-[22px] leading-[1.25] break-words">
                  <Link to={`/progress/${exercise.exerciseId}`} className="text-heading underline-offset-4">
                    {name}
                  </Link>
                </h2>
                {(exercise.skipped || exercise.extra) && (
                  <span className="shrink-0 text-sm font-bold text-accent">
                    {exercise.skipped ? t('workout.skipped') : t('detail.extra')}
                  </span>
                )}
              </div>
              {exercise.records.volume && <RecordBadge label={t('records.volume')} />}
              <ol className="m-0 flex list-none flex-col gap-1 p-0">
                {exercise.sets.map((set, index) => (
                  <li key={set.id} className="flex min-h-7 items-center gap-2 text-base">
                    <span className="w-6 shrink-0 font-bold">{format.number(index + 1)}</span>
                    {set.done ? (
                      <>
                        <span className="flex flex-1 flex-wrap items-center gap-x-2 font-medium">
                          {setText(set)}
                          {exercise.records.bySet[set.id] && <RecordBadge />}
                        </span>
                        <Check aria-label={t('workout.done')} size={20} strokeWidth={3} className="shrink-0" />
                      </>
                    ) : (
                      <span className="flex-1 text-muted">{t('detail.notDone')}</span>
                    )}
                  </li>
                ))}
              </ol>
              {exercise.note && (
                <p className="m-0 text-[15px] leading-normal break-words whitespace-pre-wrap text-muted">
                  {exercise.note}
                </p>
              )}
            </section>
          );
        })}
      </main>
    </>
  );
}
