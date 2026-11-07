import { Check, ChevronLeft, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ExercisePicker } from '../components/ExercisePicker';
import { LiveNumberField } from '../components/LiveNumberField';
import { RecordBadge, useRecordText } from '../components/Records';
import type { WorkoutSet } from '../data/db';
import type { ExerciseRecords } from '../data/records';
import { type ActiveSession, type SessionExercise, useActiveWorkout, useExercises, useTicker } from '../data/hooks';
import { addExtraExercise, addSet, type PastSet, updateExercise, updateSet } from '../data/workouts';
import { formatClock, formatWeight, parseReps, parseWeight } from '../lib/units';
import type { Unit } from '../preferences/preferences';
import { usePreferences } from '../preferences/PreferencesContext';
import { useFormat } from '../preferences/useFormat';
import { useRestTimer } from '../workout/useRestTimer';
import { useWakeLock } from '../workout/useWakeLock';

const SET_GRID = 'grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)_48px] items-center gap-2';

export function WorkoutScreen() {
  const session = useActiveWorkout();
  const exercises = useExercises();
  if (session === undefined || !exercises) return <main className="flex-1" />;
  if (session === null) return <Navigate to="/today" replace />;
  return (
    <Session
      session={session}
      nameOf={(id) => exercises.find((exercise) => exercise.id === id)?.name ?? ''}
    />
  );
}

/** The first exercise still needing work, so reopening lands where the user left off. */
function firstUnfinished(exercises: SessionExercise[]): SessionExercise | undefined {
  return exercises.find((exercise) => !exercise.skipped && exercise.sets.some((set) => !set.done)) ?? exercises[0];
}

function Session({ session, nameOf }: { session: ActiveSession; nameOf: (exerciseId: string) => string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const navigate = useNavigate();
  const now = useTicker(1000);
  const rest = useRestTimer();
  useWakeLock();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const { workout, exercises } = session;
  const current = exercises.find((exercise) => exercise.id === currentId) ?? firstUnfinished(exercises);
  const elapsed = (now.getTime() - new Date(workout.startedAt).getTime()) / 1000;

  if (picking) {
    return (
      <ExercisePicker
        onClose={() => setPicking(false)}
        onPick={async (exercise) => {
          setCurrentId(await addExtraExercise(workout.id, exercise.id));
          setPicking(false);
        }}
      />
    );
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 py-2 pr-4 pl-1">
        <div className="flex min-w-0 items-center">
          <Link
            to="/today"
            aria-label={t('nav.today')}
            className="flex size-11 shrink-0 items-center justify-center text-ink"
          >
            <ChevronLeft aria-hidden="true" size={24} strokeWidth={2.5} />
          </Link>
          <div className="flex min-w-0 flex-col">
            <h1 className="display text-[28px] leading-[1.25] break-words">{workout.routineName}</h1>
            <span className="text-[15px] text-muted tabular-nums">
              {t('workout.elapsed', { time: format.number(formatClock(elapsed)) })}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/workout/finish')}
          className="min-h-[46px] shrink-0 rounded-xl border-0 bg-done px-[18px] text-base font-bold text-on-done"
        >
          {t('workout.finish')}
        </button>
      </header>

      <main className="flex flex-1 flex-col gap-2.5 px-4 pb-3">
        {rest.remainingSeconds !== null && (
          <section
            aria-label={t('workout.rest')}
            className="sticky top-1 z-10 flex items-center justify-between gap-2 rounded-xl bg-rest py-2 pr-2.5 pl-3.5 text-on-rest"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold">{t('workout.rest')}</span>
              <span className="text-[32px] leading-[1.2] font-bold tabular-nums">
                {format.number(formatClock(rest.remainingSeconds))}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={rest.addTime}
                className="min-h-11 min-w-[60px] rounded-[10px] border-2 border-on-rest bg-transparent text-[15px] font-bold text-on-rest"
              >
                {t('workout.addRest')}
              </button>
              <button
                type="button"
                onClick={rest.skip}
                className="min-h-11 min-w-[52px] rounded-[10px] border-0 bg-on-rest text-[15px] font-bold text-rest"
              >
                {t('workout.skipRest')}
              </button>
            </div>
          </section>
        )}
        {rest.justEnded && (
          <p role="status" className="sticky top-1 z-10 m-0 rounded-xl bg-rest px-3.5 py-3 text-lg font-bold text-on-rest">
            {t('workout.restOver')}
          </p>
        )}

        {current && (
          <ExerciseCard
            key={current.id}
            exercise={current}
            name={nameOf(current.exerciseId)}
            onSetDone={rest.start}
            onSkipped={() => {
              const next = exercises.find(
                (exercise) =>
                  exercise.id !== current.id && !exercise.skipped && exercise.sets.some((set) => !set.done),
              );
              if (next) setCurrentId(next.id);
            }}
          />
        )}

        <section aria-label={t('workout.upNext')} className="flex flex-col">
          {exercises
            .filter((exercise) => exercise.id !== current?.id)
            .map((exercise) => {
              const done = exercise.sets.filter((set) => set.done).length;
              return (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => setCurrentId(exercise.id)}
                  className="divider flex min-h-11 w-full items-center justify-between gap-3 border-x-0 border-t-0 bg-transparent p-0 text-left text-base font-medium text-ink"
                >
                  <span lang="en" className="min-w-0 break-words">
                    {nameOf(exercise.exerciseId)}
                  </span>
                  <span className="shrink-0 font-bold text-accent">
                    {exercise.skipped
                      ? t('workout.skipped')
                      : `${format.number(done)}/${format.number(exercise.sets.length)}`}
                  </span>
                </button>
              );
            })}
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex min-h-11 w-full items-center gap-2 border-0 bg-transparent p-0 text-left text-base font-bold text-accent"
          >
            <Plus aria-hidden="true" size={20} strokeWidth={2.5} />
            {t('workout.addExercise')}
          </button>
        </section>
      </main>
    </>
  );
}

function useLastTimeText(last: PastSet[] | null, best: ExerciseRecords | null, unit: Unit) {
  const { t } = useTranslation();
  const format = useFormat();
  const recordText = useRecordText();
  if (!last) return t('workout.firstTime');

  const unitName = t(`units.${unit}`);
  const weightText = (weightKg: number | null) =>
    weightKg === null ? '' : `${format.number(formatWeight(weightKg, unit))} ${unitName}`;
  const repsText = (reps: number | null) => format.number(reps ?? 0);
  const sameWeight = last.every((set) => set.weightKg === last[0]?.weightKg);

  const value = sameWeight
    ? [weightText(last[0]?.weightKg ?? null), last.map((set) => repsText(set.reps)).join(', ')]
        .filter(Boolean)
        .join(' × ')
    : last.map((set) => `${weightText(set.weightKg)} × ${repsText(set.reps)}`).join(', ');
  const bestText = best ? recordText.best(best) : null;
  return bestText ? t('workout.lastAndBest', { value, best: bestText }) : t('workout.lastTime', { value });
}

function ExerciseCard({
  exercise,
  name,
  onSetDone,
  onSkipped,
}: {
  exercise: SessionExercise;
  name: string;
  onSetDone: () => void;
  onSkipped: () => void;
}) {
  const { t } = useTranslation();
  const { unit } = usePreferences();
  const [noteOpen, setNoteOpen] = useState(exercise.note !== '');
  const [note, setNote] = useState(exercise.note);
  const lastTime = useLastTimeText(exercise.last, exercise.best, unit);
  const recordSetIds = Object.keys(exercise.records.bySet).join(',');
  const seenRecords = useRef(recordSetIds);

  // A short buzz when a ticked set becomes a record. Phones without vibration simply skip it.
  useEffect(() => {
    const before = new Set(seenRecords.current.split(','));
    if (recordSetIds.split(',').some((id) => id && !before.has(id))) navigator.vibrate?.(30);
    seenRecords.current = recordSetIds;
  }, [recordSetIds]);

  return (
    <section className="card flex shrink-0 flex-col gap-2 px-3.5 py-3">
      <div className="flex flex-col">
        <h2 lang="en" className="display text-[26px] leading-[1.25] break-words">
          {name}
        </h2>
        <span className="text-[15px] text-muted">{lastTime}</span>
      </div>
      <div aria-hidden="true" className={`${SET_GRID} set-heading text-sm font-bold text-accent`}>
        <span>{t('workout.set')}</span>
        <span>{t(`units.${unit}`)}</span>
        <span>{t('common.reps')}</span>
        <span className="text-center">{t('workout.done')}</span>
      </div>
      {exercise.sets.map((set, index) => (
        <SetRow
          key={set.id}
          set={set}
          number={index + 1}
          unit={unit}
          record={set.done && Boolean(exercise.records.bySet[set.id])}
          onDone={onSetDone}
        />
      ))}
      {noteOpen && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t('workout.note')}
          <textarea
            rows={2}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              void updateExercise(exercise, { note: event.target.value });
            }}
            className="field h-auto resize-none py-2.5 text-base font-normal"
          />
        </label>
      )}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => addSet(exercise, exercise.sets[exercise.sets.length - 1])}
          className="choice min-h-11 px-1 text-[15px] font-semibold"
        >
          {t('workout.addSet')}
        </button>
        <button
          type="button"
          onClick={() => setNoteOpen(!noteOpen)}
          className="choice min-h-11 px-1 text-[15px] font-semibold"
        >
          {t('workout.note')}
        </button>
        <button
          type="button"
          onClick={async () => {
            await updateExercise(exercise, { skipped: !exercise.skipped });
            if (!exercise.skipped) onSkipped();
          }}
          className="choice min-h-11 px-1 text-[15px] font-semibold"
        >
          {exercise.skipped ? t('workout.undoSkip') : t('workout.skip')}
        </button>
      </div>
    </section>
  );
}

function SetRow({
  set,
  number,
  unit,
  record,
  onDone,
}: {
  set: WorkoutSet;
  number: number;
  unit: Unit;
  record: boolean;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const shown = format.number(number);

  return (
    <>
    <div className={SET_GRID}>
      <span className="text-xl font-bold">{shown}</span>
      <LiveNumberField
        label={t('workout.weightOf', { number: shown })}
        value={formatWeight(set.weightKg, unit)}
        decimal
        maxLength={6}
        className="field field-set"
        onChange={(text) => updateSet(set, { weightKg: parseWeight(text, unit) })}
      />
      <LiveNumberField
        label={t('workout.repsOf', { number: shown })}
        value={set.reps === null ? '' : String(set.reps)}
        maxLength={3}
        className="field field-set"
        onChange={(text) => updateSet(set, { reps: parseReps(text) })}
      />
      <button
        type="button"
        aria-label={t('workout.markDone', { number: shown })}
        aria-pressed={set.done}
        onClick={() => {
          void updateSet(set, { done: !set.done });
          if (!set.done) onDone();
        }}
        className={`flex size-12 items-center justify-center rounded-[10px] border-2 p-0 text-on-done ${
          set.done ? 'border-done bg-done' : 'border-control bg-transparent'
        }`}
      >
        {set.done && <Check aria-hidden="true" size={24} strokeWidth={3} />}
      </button>
    </div>
    {record && (
      <p role="status" className="m-0 -mt-1 pl-11">
        <RecordBadge />
      </p>
    )}
    </>
  );
}
