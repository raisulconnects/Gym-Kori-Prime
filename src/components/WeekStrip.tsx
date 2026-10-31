import { Check, Minus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AttendanceDay, DayStatus } from '../data/attendance';
import { toLocalDate } from '../lib/week';
import { useFormat } from '../preferences/useFormat';

const ICONS = { done: Check, missed: X, rest: Minus } as const;

function circleClasses(status: DayStatus, isToday: boolean): string {
  if (status === 'done') return 'bg-done text-on-done';
  if (isToday) return 'bg-today text-on-today';
  if (status === 'missed') return 'border-2 border-danger-on-card text-danger-on-card';
  if (status === 'rest') return 'text-muted';
  return 'border-2 border-control';
}

/** A row of seven days showing attendance. Works on the page or inside a card. */
export function WeekStrip({ days, label }: { days: AttendanceDay[]; label: string }) {
  const { t } = useTranslation();
  const format = useFormat();
  const today = toLocalDate(new Date());

  return (
    <ol aria-label={label} className="m-0 grid list-none grid-cols-7 gap-0.5 p-0">
      {days.map((day) => {
        const isToday = day.localDate === today;
        const Icon = day.status === 'done' || day.status === 'missed' || day.status === 'rest' ? ICONS[day.status] : null;
        const description = [
          format.dayName(day.date),
          isToday && t('week.todaySuffix'),
          day.status === 'done' && t('week.doneSuffix'),
          day.status === 'missed' && t('week.missedSuffix'),
          day.status === 'rest' && t('week.restSuffix'),
        ]
          .filter(Boolean)
          .join(', ');
        return (
          <li key={day.localDate} className="flex flex-col items-center gap-1">
            <span aria-hidden="true" className="text-[13px] leading-[1.3] font-semibold">
              {format.dayShort(day.date)}
            </span>
            <span
              role="img"
              aria-label={description}
              aria-current={isToday ? 'date' : undefined}
              className={`box-border flex size-[34px] items-center justify-center rounded-full ${circleClasses(day.status, isToday)}`}
              style={isToday && day.status !== 'done' ? { border: 'var(--today-border)' } : undefined}
            >
              {Icon && <Icon aria-hidden="true" size={16} strokeWidth={3} />}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
