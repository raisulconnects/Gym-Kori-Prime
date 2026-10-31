import { ChevronLeft, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ExercisePicker } from '../components/ExercisePicker';
import { NumberField } from '../components/NumberField';
import { useExercises, useRoutines } from '../data/hooks';
import { deleteRoutine, saveRoutine } from '../data/store';
import { createId } from '../lib/ids';
import { toLocalDate } from '../lib/week';

interface DraftRow {
  /** Identifies the row on screen, including rows not saved yet. */
  key: string;
  savedId?: string;
  exerciseId: string;
  sets: string;
  reps: string;
}

interface Draft {
  name: string;
  rows: DraftRow[];
}

type ErrorKey = 'editor.errorName' | 'editor.errorExercises' | 'editor.errorTargets';

function findError(draft: Draft): ErrorKey | null {
  if (!draft.name.trim()) return 'editor.errorName';
  if (draft.rows.length === 0) return 'editor.errorExercises';
  if (draft.rows.some((row) => !(Number(row.sets) >= 1) || !(Number(row.reps) >= 1))) return 'editor.errorTargets';
  return null;
}

/** Waits for the saved routine to load, so the form starts with the right values. */
export function RoutineEditorScreen() {
  const { routineId } = useParams();
  const routines = useRoutines();
  if (!routineId) return <RoutineForm initial={{ name: '', rows: [] }} />;
  if (!routines) return null;

  const routine = routines.find((candidate) => candidate.id === routineId);
  if (!routine) return <Navigate to="/routines" replace />;

  return (
    <RoutineForm
      key={routine.id}
      routineId={routine.id}
      initial={{
        name: routine.name,
        rows: routine.items.map((item) => ({
          key: item.id,
          savedId: item.id,
          exerciseId: item.exerciseId,
          sets: String(item.sets),
          reps: String(item.reps),
        })),
      }}
    />
  );
}

function RoutineForm({ routineId, initial }: { routineId?: string; initial: Draft }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const exercises = useExercises();
  const [draft, setDraft] = useState(initial);
  const [saved] = useState(() => JSON.stringify(initial));
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);

  const nameOf = (exerciseId: string) => exercises?.find((exercise) => exercise.id === exerciseId)?.name ?? '';

  function updateRow(key: string, changes: Partial<DraftRow>) {
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.key === key ? { ...row, ...changes } : row)),
    }));
  }

  async function save() {
    const problem = findError(draft);
    setError(problem);
    if (problem) return;
    await saveRoutine({
      id: routineId,
      name: draft.name,
      items: draft.rows.map((row) => ({
        id: row.savedId,
        exerciseId: row.exerciseId,
        sets: Number(row.sets),
        reps: Number(row.reps),
      })),
    });
    navigate('/routines');
  }

  function leave() {
    if (JSON.stringify(draft) === saved || window.confirm(t('editor.confirmDiscard'))) navigate('/routines');
  }

  async function remove() {
    if (!routineId || !window.confirm(t('editor.confirmDelete'))) return;
    await deleteRoutine(routineId, toLocalDate(new Date()));
    navigate('/routines');
  }

  if (picking) {
    return (
      <ExercisePicker
        onClose={() => setPicking(false)}
        onPick={(exercise) => {
          setDraft((current) => ({
            ...current,
            rows: [...current.rows, { key: createId(), exerciseId: exercise.id, sets: '3', reps: '10' }],
          }));
          setError(null);
          setPicking(false);
        }}
      />
    );
  }

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-2 pt-2.5 pb-1.5">
        <button
          type="button"
          onClick={leave}
          className="flex min-h-11 items-center gap-0.5 border-0 bg-transparent px-2 font-semibold text-ink"
        >
          <ChevronLeft aria-hidden="true" size={20} strokeWidth={2.5} />
          {t('nav.routines')}
        </button>
        <button type="button" onClick={save} className="small-action mr-2">
          {t('common.save')}
        </button>
      </header>
      <main className="flex flex-1 flex-col gap-3 px-4 pb-4">
        <h1 className="sr-only">{draft.name || t('editor.newTitle')}</h1>
        {error && (
          <p role="alert" className="m-0 text-base font-semibold text-danger">
            {t(error)}
          </p>
        )}
        <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
          {t('editor.name')}
          <input
            autoComplete="off"
            maxLength={40}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className="field"
          />
        </label>

        {draft.rows.length === 0 ? (
          <p className="m-0 text-base text-muted">{t('editor.empty')}</p>
        ) : (
          <div
            aria-hidden="true"
            className="grid grid-cols-[minmax(0,1fr)_52px_52px_44px] gap-1.5 text-sm font-bold text-accent"
          >
            <span>{t('editor.exercise')}</span>
            <span className="text-center">{t('common.sets')}</span>
            <span className="text-center">{t('common.reps')}</span>
          </div>
        )}
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {draft.rows.map((row) => {
            const name = nameOf(row.exerciseId);
            return (
              <li
                key={row.key}
                className="divider grid min-h-[52px] grid-cols-[minmax(0,1fr)_52px_52px_44px] items-center gap-1.5 pb-1"
              >
                <span lang="en" className="text-base leading-tight font-medium break-words">
                  {name}
                </span>
                <NumberField
                  label={t('editor.setsOf', { name })}
                  value={row.sets}
                  onChange={(sets) => updateRow(row.key, { sets })}
                />
                <NumberField
                  label={t('editor.repsOf', { name })}
                  value={row.reps}
                  onChange={(reps) => updateRow(row.key, { reps })}
                />
                <button
                  type="button"
                  aria-label={t('editor.remove', { name })}
                  onClick={() => setDraft({ ...draft, rows: draft.rows.filter((other) => other.key !== row.key) })}
                  className="flex size-11 items-center justify-center border-0 bg-transparent p-0 text-ink"
                >
                  <X aria-hidden="true" size={20} strokeWidth={2.5} />
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => setPicking(true)} className="outline-action">
          <Plus aria-hidden="true" size={20} strokeWidth={2.5} />
          {t('editor.add')}
        </button>
        {routineId && (
          <button
            type="button"
            onClick={remove}
            className="mt-4 min-h-12 border-0 bg-transparent text-base font-bold text-danger"
          >
            {t('editor.delete')}
          </button>
        )}
      </main>
    </>
  );
}
