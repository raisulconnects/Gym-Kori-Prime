import { UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ThemeMotif } from '../components/ThemeDecorations';
import { WeekStrip } from '../components/WeekStrip';
import { useFormat } from '../preferences/useFormat';

export function TodayScreen() {
  const { t } = useTranslation();
  const format = useFormat();
  const now = new Date();

  return (
    <main className="flex flex-1 flex-col gap-3 px-4 py-3">
      <div className="flex min-h-11 items-center justify-between">
        <span className="text-[15px] font-semibold text-muted">{format.date(now)}</span>
        <Link
          to="/settings"
          aria-label={t('settings.open')}
          className="-mr-2 flex size-11 items-center justify-center text-ink"
        >
          <UserRound aria-hidden="true" size={26} />
        </Link>
      </div>
      <WeekStrip date={now} />
      <section className="card relative flex flex-col gap-3.5 overflow-hidden p-5">
        <ThemeMotif />
        <div className="relative flex flex-col gap-1">
          <h2 className="section-label">{t('today.label')}</h2>
          <h1 className="display pr-[108px] text-[38px]">{t('today.noPlanTitle')}</h1>
          <p className="m-0 text-base leading-normal text-muted">{t('today.noPlanBody')}</p>
        </div>
        <Link to="/routines" className="cta relative">
          {t('today.setUpWeek')}
        </Link>
      </section>
    </main>
  );
}
