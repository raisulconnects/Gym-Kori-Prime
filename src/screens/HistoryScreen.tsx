import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { WeekStrip } from '../components/WeekStrip';
import { summarizeWeek } from '../data/attendance';
import { useNow, useWeekHistory, type WorkoutCounts } from '../data/hooks';
import { daysOfWeek, toLocalDate } from '../lib/week';
import { useFormat } from '../preferences/useFormat';
import { EmptyListScreen } from './EmptyListScreen';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function shiftWeeks(date: Date, weeks: number): Date {
  return new Date(date.getTime() + weeks * WEEK_MS);
}

export function HistoryScreen() {
  const { t } = useTranslation();
  const format = useFormat();
  const now = useNow();
  const today = toLocalDate(now);
  const [weeksBack, setWeeksBack] = useState(0);
  const weekDate = shiftWeeks(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12), -weeksBack);
  const history = useWeekHistory(weekDate, today);

  if (!history) return <main className="flex-1" />;
  if (!history.firstDate) {
    return (
      <EmptyListScreen title={t('history.title')} emptyTitle={t('history.emptyTitle')} emptyBody={t('history.emptyBody')} />
    );
  }

  const week = daysOfWeek(weekDate);
  const firstDay = week[0] ?? weekDate;
  const lastDay = week[6] ?? weekDate;
  const canGoBack = history.firstDate < toLocalDate(firstDay);
  const summary = summarizeWeek(history.days);

  let weekTitle = `${format.dayMonth(firstDay)} – ${format.dayMonth(lastDay)}`;
  if (weeksBack === 0) weekTitle = t('history.thisWeek');
  if (weeksBack === 1) weekTitle = t('history.lastWeek');

  const rows = history.days
    .filter((day) => day.localDate <= today && (day.status === 'done' || day.status === 'missed'))
    .reverse();

  return (
    <main className="flex flex-1 flex-col gap-3.5 px-4 pt-[18px] pb-3">
      <h1 className="display text-[38px]">{t('history.title')}</h1>

      <section className="card flex flex-col gap-2.5 p-3.5">
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            aria-label={t('history.previousWeek')}
            disabled={!canGoBack}
            onClick={() => setWeeksBack(weeksBack + 1)}
            className="-ml-2 flex size-11 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-ink disabled:opacity-40"
          >
            <ChevronLeft aria-hidden="true" size={24} strokeWidth={2.5} />
          </button>
          <div className="flex min-w-0 flex-col items-center text-center">
            <h2 className="section-label">{weekTitle}</h2>
            <span className="text-lg font-bold">
              {t('history.attendance', {
                attended: format.number(summary.attended),
                expected: format.number(summary.expected),
              })}
            </span>
          </div>
          <button
            type="button"
            aria-label={t('history.nextWeek')}
            disabled={weeksBack === 0}
            onClick={() => setWeeksBack(weeksBack - 1)}
            className="-mr-2 flex size-11 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-ink disabled:opacity-40"
          >
            <ChevronRight aria-hidden="true" size={24} strokeWidth={2.5} />
          </button>
        </div>
        <WeekStrip days={history.days} label={weekTitle} />
      </section>

      {rows.length === 0 ? (
        <p className="m-0 text-base text-muted">{t('history.nothingThisWeek')}</p>
      ) : (
        <ul aria-label={t('history.workouts')} className="m-0 flex list-none flex-col p-0">
          {rows.flatMap((day) => {
            const dateColumn = (
              <span className="flex flex-col text-[13px] leading-[1.35] font-medium text-muted">
                <span>{format.dayMedium(day.date)}</span>
                <span>{format.dayMonth(day.date)}</span>
              </span>
            );
            if (day.status === 'missed') {
              return [
                <li
                  key={day.localDate}
                  className="divider grid min-h-[68px] grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-2 py-1.5"
                >
                  {dateColumn}
                  <span className="flex min-w-0 flex-col">
                    <span className="font-display text-[21px] leading-[1.3] font-[var(--display-weight)] break-words">
                      {(day.plannedRoutineId && history.routineNames.get(day.plannedRoutineId)) ?? ''}
                    </span>
                    <span className="text-sm text-muted">{t('history.notDone')}</span>
                  </span>
                  <span className="text-base font-bold text-danger">{t('history.missed')}</span>
                </li>,
              ];
            }
            return day.workouts
              .filter((workout) => workout.status === 'finished')
              .map((workout) => (
                <li key={workout.id}>
                  <Link
                    to={`/history/${workout.id}`}
                    className="divider grid min-h-[68px] grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-2 py-1.5 text-ink no-underline"
                  >
                    {dateColumn}
                    <span className="flex min-w-0 flex-col">
                      <span className="font-display text-[21px] leading-[1.3] font-[var(--display-weight)] break-words">
                        {workout.routineName}
                      </span>
                      <CountsText counts={history.counts.get(workout.id)} />
                    </span>
                    <span className="flex items-center gap-1 text-base font-bold">
                      {t('history.minutes', { minutes: format.number(Math.round((workout.durationSeconds ?? 0) / 60)) })}
                      <ChevronRight aria-hidden="true" size={16} />
                    </span>
                  </Link>
                </li>
              ));
          })}
        </ul>
      )}
    </main>
  );
}

function CountsText({ counts }: { counts: WorkoutCounts | undefined }) {
  const { t } = useTranslation();
  const format = useFormat();
  if (!counts) return null;
  const parts = [t('history.exerciseCount', { done: format.number(counts.done), total: format.number(counts.total) })];
  if (counts.extras > 0) parts.push(t('history.extras', { count: counts.extras, shown: format.number(counts.extras) }));
  if (counts.notes > 0) parts.push(t('history.notes', { count: counts.notes, shown: format.number(counts.notes) }));
  return <span className="text-sm text-muted">{parts.join(' · ')}</span>;
}
