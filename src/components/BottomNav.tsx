import { CalendarDays, Dumbbell, ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

const ITEMS = [
  { to: '/today', key: 'nav.today', Icon: Dumbbell },
  { to: '/routines', key: 'nav.routines', Icon: ListChecks },
  { to: '/history', key: 'nav.history', Icon: CalendarDays },
] as const;

export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('nav.mainMenu')}
      className="sticky bottom-0 grid shrink-0 grid-cols-3 bg-nav px-2 pt-1 pb-[max(12px,env(safe-area-inset-bottom))]"
      style={{ borderTop: 'var(--nav-line)' }}
    >
      {ITEMS.map(({ to, key, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex min-h-14 flex-col items-center justify-center gap-0.5 text-sm no-underline ${
              isActive ? 'font-bold text-accent' : 'font-medium text-muted'
            }`
          }
        >
          <Icon aria-hidden="true" size={24} strokeWidth={2.25} />
          {t(key)}
        </NavLink>
      ))}
    </nav>
  );
}
