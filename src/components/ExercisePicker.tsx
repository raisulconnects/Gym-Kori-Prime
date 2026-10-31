import { ChevronLeft, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ExerciseOption, exerciseKey, searchExercises } from '../data/exerciseCatalog';
import { useExercises } from '../data/hooks';
import { addCustomExercise } from '../data/store';

export function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (exercise: ExerciseOption) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const exercises = useExercises();
  const [query, setQuery] = useState('');
  const typed = query.trim();
  const results = exercises ? searchExercises(exercises, query) : [];
  const hasExactMatch = results.some((exercise) => exerciseKey(exercise.name) === exerciseKey(typed));

  return (
    <>
      <header className="px-2 pt-2.5 pb-1.5">
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-11 items-center gap-0.5 border-0 bg-transparent px-2 font-semibold text-ink"
        >
          <ChevronLeft aria-hidden="true" size={20} strokeWidth={2.5} />
          {t('common.back')}
        </button>
      </header>
      <main className="flex flex-1 flex-col gap-2.5 px-4 pb-4">
        <h1 className="display text-[28px]">{t('picker.title')}</h1>
        <input
          type="search"
          aria-label={t('picker.search')}
          placeholder={t('picker.search')}
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="field"
        />
        {typed && !hasExactMatch && (
          <button
            type="button"
            onClick={async () => onPick(await addCustomExercise(typed))}
            className="outline-action"
          >
            <Plus aria-hidden="true" size={20} strokeWidth={2.5} className="shrink-0" />
            <span className="min-w-0 break-words">{t('picker.addCustom', { name: typed })}</span>
          </button>
        )}
        {exercises && results.length === 0 && <p className="m-0 text-base text-muted">{t('picker.noMatch')}</p>}
        <ul className="m-0 flex list-none flex-col p-0">
          {results.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                lang="en"
                onClick={() => onPick(exercise)}
                className="divider flex min-h-12 w-full items-center justify-between gap-3 border-x-0 border-t-0 bg-transparent p-0 text-left text-base font-medium text-ink"
              >
                <span className="min-w-0 break-words">{exercise.name}</span>
                <Plus aria-hidden="true" size={20} strokeWidth={2.5} className="shrink-0 text-accent" />
              </button>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
