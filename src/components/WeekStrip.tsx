import { Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { WeekPlan } from '../data/db';
import { daysOfWeek, isSameDay } from '../lib/week';
import { useFormat } from '../preferences/useFormat';

/** Without a plan, no day is shown as a rest day. */
export function WeekStrip({ date, plan }: { date: Date; plan?: WeekPlan }) {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <ol aria-label={t('today.thisWeek')} className="m-0 grid list-none grid-cols-7 gap-0.5 p-0">
      {daysOfWeek(date).map((day) => {
        const isToday = isSameDay(day, date);
        const isRest = plan?.[day.getDay()] === null;
        const label = [format.dayName(day), isToday && t('week.todaySuffix'), isRest && t('week.restSuffix')]
          .filter(Boolean)
          .join(', ');
        return (
          <li key={day.getTime()} className="flex flex-col items-center gap-1">
            <span aria-hidden="true" className="text-[13px] leading-[1.3] font-semibold text-muted">
              {format.dayShort(day)}
            </span>
            <span
              role="img"
              aria-label={label}
              aria-current={isToday ? 'date' : undefined}
              className={`box-border flex size-[34px] items-center justify-center rounded-full ${
                isToday ? 'bg-today text-on-today' : isRest ? 'text-muted' : 'border-2 border-control'
              }`}
              style={isToday ? { border: 'var(--today-border)' } : undefined}
            >
              {isRest && <Minus aria-hidden="true" size={16} strokeWidth={3} />}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
