import { useTranslation } from 'react-i18next';
import { daysOfWeek, isSameDay } from '../lib/week';
import { useFormat } from '../preferences/useFormat';

export function WeekStrip({ date }: { date: Date }) {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <ol aria-label={t('today.thisWeek')} className="m-0 grid list-none grid-cols-7 gap-0.5 p-0">
      {daysOfWeek(date).map((day) => {
        const isToday = isSameDay(day, date);
        return (
          <li key={day.getTime()} className="flex flex-col items-center gap-1">
            <span aria-hidden="true" className="text-[13px] leading-[1.3] font-semibold text-muted">
              {format.dayShort(day)}
            </span>
            <span
              role="img"
              aria-label={isToday ? `${format.dayName(day)}, ${t('week.todaySuffix')}` : format.dayName(day)}
              aria-current={isToday ? 'date' : undefined}
              className={`box-border size-[34px] rounded-full ${isToday ? 'bg-today' : 'border-2 border-control'}`}
              style={isToday ? { border: 'var(--today-border)' } : undefined}
            />
          </li>
        );
      })}
    </ol>
  );
}
