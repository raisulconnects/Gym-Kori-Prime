import { Check, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { type RoutineWithItems, useNow, useRoutines, useSchedule } from '../data/hooks';
import { setWeekday } from '../data/store';
import { daysOfWeek, toLocalDate } from '../lib/week';
import { useFormat } from '../preferences/useFormat';

function DayPlanSheet({
  title,
  routines,
  selected,
  onPick,
  onClose,
}: {
  title: string;
  routines: RoutineWithItems[];
  selected: string | null;
  onPick: (routineId: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const options = [
    ...routines.map((routine) => ({ id: routine.id as string | null, label: routine.name })),
    { id: null, label: t('routines.rest') },
  ];

  return (
    <dialog ref={dialog} aria-labelledby="day-plan-title" onCancel={onClose} className="sheet">
      <div className="flex flex-col gap-2">
        <h2 id="day-plan-title" className="display mb-1 text-[26px] leading-[1.3]">
          {title}
        </h2>
        {options.map((option) => {
          const isSelected = option.id === selected;
          return (
            <button
              key={option.id ?? 'rest'}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onPick(option.id)}
              className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border-2 border-control bg-transparent px-3.5 text-left text-[17px] font-semibold text-ink"
            >
              <span className="min-w-0 break-words">{option.label}</span>
              {isSelected && <Check aria-hidden="true" size={22} strokeWidth={3} className="shrink-0" />}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onClose}
          className="min-h-12 border-0 bg-transparent text-base font-semibold text-ink"
        >
          {t('common.cancel')}
        </button>
      </div>
    </dialog>
  );
}

export function RoutinesScreen() {
  const { t } = useTranslation();
  const format = useFormat();
  const now = useNow();
  const today = toLocalDate(now);
  const routines = useRoutines();
  const plan = useSchedule(today);
  const [editingDay, setEditingDay] = useState<Date | null>(null);

  if (!routines || !plan) return <main className="flex-1" />;

  const nameOf = (routineId: string | null | undefined) =>
    routines.find((routine) => routine.id === routineId)?.name ?? t('routines.rest');

  return (
    <main className="flex flex-1 flex-col gap-3.5 px-4 pt-[18px] pb-3">
      <h1 className="display text-[38px]">{t('routines.title')}</h1>

      {routines.length === 0 ? (
        <section className="card flex flex-col gap-3.5 p-5">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-xl font-bold">{t('routines.emptyTitle')}</h2>
            <p className="m-0 text-base leading-normal text-muted">{t('routines.emptyBody')}</p>
          </div>
          <Link to="/routines/new" className="cta">
            {t('routines.new')}
          </Link>
        </section>
      ) : (
        <>
          <section className="flex flex-col">
            <h2 className="section-label mb-0.5">{t('routines.yourWeek')}</h2>
            {daysOfWeek(now).map((day) => {
              const routineName = nameOf(plan[day.getDay()]);
              return (
                <button
                  key={day.getTime()}
                  type="button"
                  aria-label={`${format.dayName(day)}: ${routineName}`}
                  onClick={() => setEditingDay(day)}
                  className="divider grid min-h-11 w-full grid-cols-[64px_minmax(0,1fr)_20px] items-center gap-1 border-x-0 border-t-0 bg-transparent p-0 text-left text-[17px] font-medium text-ink"
                >
                  <span className="font-semibold text-muted">{format.dayMedium(day)}</span>
                  <span className="min-w-0 break-words">{routineName}</span>
                  <ChevronRight aria-hidden="true" size={18} />
                </button>
              );
            })}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="section-label">{t('routines.saved')}</h2>
            {routines.map((routine) => (
              <Link
                key={routine.id}
                to={`/routines/${routine.id}`}
                className="card flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 text-ink no-underline"
              >
                <span className="font-display min-w-0 text-[22px] leading-tight font-[var(--display-weight)] break-words">
                  {routine.name}
                </span>
                <span className="shrink-0 text-[15px] text-muted">
                  {t('routines.count', { count: routine.items.length, exercises: format.number(routine.items.length) })}
                </span>
              </Link>
            ))}
            <Link to="/routines/new" className="outline-action no-underline">
              <Plus aria-hidden="true" size={20} strokeWidth={2.5} />
              {t('routines.new')}
            </Link>
          </section>
        </>
      )}

      {editingDay && (
        <DayPlanSheet
          title={t('routines.chooseFor', { day: format.dayName(editingDay) })}
          routines={routines}
          selected={plan[editingDay.getDay()] ?? null}
          onClose={() => setEditingDay(null)}
          onPick={async (routineId) => {
            await setWeekday(editingDay.getDay(), routineId, today);
            setEditingDay(null);
          }}
        />
      )}
    </main>
  );
}
