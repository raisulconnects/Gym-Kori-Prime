import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { RecordBadge, useRecordText } from '../components/Records';
import { useExerciseHistory } from '../data/hooks';
import type { RecordKind, RecordSet } from '../data/records';
import { formatWeight } from '../lib/units';
import { fromLocalDate } from '../lib/week';
import { usePreferences } from '../preferences/PreferencesContext';
import { useFormat } from '../preferences/useFormat';

const RECORD_KINDS: RecordKind[] = ['heaviest', 'oneRepMax', 'mostReps', 'volume'];

function useSetText() {
  const { t } = useTranslation();
  const { unit } = usePreferences();
  const format = useFormat();
  return (set: RecordSet) => {
    const reps = set.reps === null ? '–' : format.number(set.reps);
    if (set.weightKg === null) return t('detail.repsOnly', { reps });
    return t('detail.weightAndReps', {
      weight: format.number(formatWeight(set.weightKg, unit)),
      unit: t(`units.${unit}`),
      reps,
    });
  };
}

export function ExerciseScreen() {
  const { t } = useTranslation();
  const format = useFormat();
  const recordText = useRecordText();
  const setText = useSetText();
  const { exerciseId = '' } = useParams();
  const history = useExerciseHistory(exerciseId);

  if (!history) return <main className="flex-1" />;
  const bodyweight = !history.records.heaviest && history.sessions.length > 0;
  // Weight records mean nothing for bodyweight exercises, so only most reps is shown for them.
  const kinds = bodyweight ? (['mostReps'] as RecordKind[]) : RECORD_KINDS;

  return (
    <>
      <header className="px-2 pt-2.5 pb-0.5">
        <Link to="/progress" className="flex min-h-11 w-fit items-center gap-0.5 px-2 font-semibold text-ink no-underline">
          <ChevronLeft aria-hidden="true" size={20} strokeWidth={2.5} />
          {t('progress.title')}
        </Link>
      </header>
      <main className="flex flex-1 flex-col gap-3.5 px-4 pb-4">
        <h1 lang="en" className="display text-[34px] break-words">
          {history.name}
        </h1>

        <section className="card flex flex-col gap-3 p-4">
          <h2 className="section-label">{t('records.title')}</h2>
          <dl className={`m-0 grid gap-2.5 ${kinds.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {kinds.map((kind) => {
              const record = history.records[kind];
              return (
                <div key={kind} className="flex min-w-0 flex-col gap-0.5 rounded-xl border-2 border-control p-3">
                  <dt className="text-sm font-semibold text-muted">{t(`records.${kind}`)}</dt>
                  <dd className="m-0 text-xl leading-tight font-bold break-words">
                    {record ? recordText.value(kind, record) : t('records.none')}
                  </dd>
                  {record && (
                    <dd className="m-0 text-sm text-muted">{format.dayMonth(fromLocalDate(record.localDate))}</dd>
                  )}
                </div>
              );
            })}
          </dl>
          {!bodyweight && <p className="m-0 text-sm leading-normal text-muted">{t('records.oneRepMaxHelp')}</p>}
        </section>

        <section aria-labelledby="past-sessions" className="flex flex-col gap-1">
          <h2 id="past-sessions" className="section-label">
            {t('records.pastSessions')}
          </h2>
          {history.sessions.length === 0 && <p className="m-0 text-base text-muted">{t('progress.emptyBody')}</p>}
          <ul className="m-0 flex list-none flex-col p-0">
            {history.sessions.map((session) => (
              <li key={session.workoutId} className="divider">
                <Link to={`/history/${session.workoutId}`} className="flex items-center gap-3 py-2.5 text-ink no-underline">
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-base font-bold">{format.dayMonth(fromLocalDate(session.localDate))}</span>
                      <span className="min-w-0 text-[15px] break-words text-muted">{session.routineName}</span>
                      {session.records.volume && <RecordBadge label={t('records.volume')} />}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      {session.sets.map((set) => (
                        <span key={set.id} className="flex flex-wrap items-center gap-x-2 text-[15px]">
                          {setText(set)}
                          {session.records.bySet[set.id] && <RecordBadge />}
                        </span>
                      ))}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" size={22} className="shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
