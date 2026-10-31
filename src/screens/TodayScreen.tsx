import { UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ThemeMotif } from '../components/ThemeDecorations';
import { WeekStrip } from '../components/WeekStrip';
import { type RoutineWithItems, useExercises, useNow, useRoutines, useSchedule } from '../data/hooks';
import { toLocalDate } from '../lib/week';
import { useFormat } from '../preferences/useFormat';

const MINUTES_PER_SET = 3;
const LONG_NAME_LENGTH = 16;

/** A rough duration, rounded to 5 minutes so it doesn't look more exact than it is. */
function estimateMinutes(routine: RoutineWithItems): number {
  const sets = routine.items.reduce((total, item) => total + item.sets, 0);
  return Math.max(5, Math.round((sets * MINUTES_PER_SET) / 5) * 5);
}

export function TodayScreen() {
  const { t } = useTranslation();
  const format = useFormat();
  const now = useNow();
  const routines = useRoutines();
  const plan = useSchedule(toLocalDate(now));
  const exercises = useExercises();
  const loaded = routines && plan && exercises;

  const todaysRoutine = loaded ? routines.find((routine) => routine.id === plan[now.getDay()]) : undefined;
  const hasPlan = loaded && plan.some((day) => routines.some((routine) => routine.id === day));

  return (
    <main className="flex flex-1 flex-col gap-3 px-4 py-3">
      <div className="flex min-h-11 items-center justify-between">
        <span className="text-[15px] font-semibold text-muted">{format.date(now)}</span>
        <Link
          to="/settings"
          aria-label={t('settings.open')}
          className="-mr-2 flex size-11 items-center justify-center text-ink"
        >
          <UserRound aria-hidden="true" size={26} />
        </Link>
      </div>
      <WeekStrip date={now} plan={hasPlan ? plan : undefined} />
      {loaded && (
        <section className="card relative flex flex-col gap-3.5 overflow-hidden p-5">
          <ThemeMotif />
          <div className="relative flex flex-col gap-1">
            <h2 className="section-label">{t('today.label')}</h2>
            {todaysRoutine ? (
              <>
                <h1
                  className={`display beside-motif break-words ${
                    todaysRoutine.name.length > LONG_NAME_LENGTH ? 'text-[30px]' : 'text-[42px]'
                  }`}
                >
                  {todaysRoutine.name}
                </h1>
                <p className="m-0 text-base leading-normal text-muted">
                  {t('today.summary', {
                    count: todaysRoutine.items.length,
                    exercises: format.number(todaysRoutine.items.length),
                    minutes: format.number(estimateMinutes(todaysRoutine)),
                  })}
                </p>
              </>
            ) : hasPlan ? (
              <>
                <h1 className="display beside-motif text-[38px]">{t('today.restTitle')}</h1>
                <p className="m-0 text-base leading-normal text-muted">{t('today.restBody')}</p>
              </>
            ) : (
              <>
                <h1 className="display beside-motif text-[38px]">{t('today.noPlanTitle')}</h1>
                <p className="m-0 text-base leading-normal text-muted">{t('today.noPlanBody')}</p>
              </>
            )}
          </div>
          {!hasPlan && (
            <Link to="/routines" className="cta relative">
              {t('today.setUpWeek')}
            </Link>
          )}
        </section>
      )}
      {todaysRoutine && (
        <ul aria-label={t('today.exercises')} className="m-0 flex list-none flex-col p-0">
          {todaysRoutine.items.map((item) => (
            <li
              key={item.id}
              className="divider flex min-h-11 items-center justify-between gap-3 text-base font-medium"
            >
              <span lang="en" className="min-w-0 break-words">
                {exercises?.find((exercise) => exercise.id === item.exerciseId)?.name}
              </span>
              <span className="shrink-0 font-bold text-accent">
                {t('today.target', { sets: format.number(item.sets), reps: format.number(item.reps) })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
