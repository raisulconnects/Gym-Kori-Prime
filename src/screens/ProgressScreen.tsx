import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useRecordText } from '../components/Records';
import { searchExercises } from '../data/exerciseCatalog';
import { useExerciseProgressList } from '../data/hooks';
import { fromLocalDate } from '../lib/week';
import { useFormat } from '../preferences/useFormat';
import { EmptyListScreen } from './EmptyListScreen';

export function ProgressScreen() {
  const { t } = useTranslation();
  const format = useFormat();
  const recordText = useRecordText();
  const list = useExerciseProgressList();
  const [query, setQuery] = useState('');

  if (!list) return <main className="flex-1" />;
  if (list.length === 0) {
    return (
      <EmptyListScreen title={t('progress.title')} emptyTitle={t('progress.emptyTitle')} emptyBody={t('progress.emptyBody')} />
    );
  }

  // Search keeps the most-recent-first order of the full list.
  const matches = new Set(searchExercises(list.map(({ exerciseId: id, name }) => ({ id, name })), query).map((match) => match.id));
  const shown = list.filter((item) => matches.has(item.exerciseId));

  return (
    <main className="flex flex-1 flex-col gap-3.5 px-4 pt-[18px] pb-3">
      <h1 className="display text-[38px]">{t('progress.title')}</h1>
      <input
        type="search"
        aria-label={t('picker.search')}
        placeholder={t('picker.search')}
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="field"
      />
      <section aria-label={t('progress.exercises')} className="flex flex-col">
        {shown.length === 0 && <p className="m-0 py-3 text-base text-muted">{t('picker.noMatch')}</p>}
        {shown.map((item) => {
          const best = recordText.best(item.records);
          return (
            <Link
              key={item.exerciseId}
              to={`/progress/${item.exerciseId}`}
              className="divider flex min-h-16 items-center gap-3 py-2 text-ink no-underline"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span lang="en" className="text-[17px] font-bold break-words">
                  {item.name}
                </span>
                <span className="text-[15px] text-muted">
                  {best ? `${t('progress.best', { value: best })} · ` : ''}
                  {format.dayMonth(fromLocalDate(item.lastDate))}
                </span>
              </span>
              <ChevronRight aria-hidden="true" size={22} className="shrink-0 text-muted" />
            </Link>
          );
        })}
      </section>
    </main>
  );
}
