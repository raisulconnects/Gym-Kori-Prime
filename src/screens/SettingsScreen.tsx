import { Check, ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LANGUAGES, type Language, THEMES, type Theme, UNITS } from '../preferences/preferences';
import { usePreferences } from '../preferences/PreferencesContext';

const LANGUAGE_LABELS: Record<Language, string> = { en: 'English', bn: 'বাংলা' };

/** Small color previews, fixed per theme so each option shows its own look. */
const THEME_SWATCHES: Record<Theme, [string, string, string]> = {
  modern: ['#111827', '#1F2937', '#F97316'],
  kantha: ['#F7EFDC', '#FFF9EC', '#A61C28'],
  rickshaw: ['#12235A', '#A80F3C', '#FFC914'],
};

function OptionGroup({ title, className, children }: { title: string; className: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="section-label mb-1.5 p-0">{title}</legend>
      <div className={className}>{children}</div>
    </fieldset>
  );
}

export function SettingsScreen() {
  const { t } = useTranslation();
  const { language, theme, unit, update } = usePreferences();

  return (
    <>
      <header className="px-2 pt-2.5 pb-0.5">
        <Link to="/today" className="flex min-h-11 w-fit items-center gap-0.5 px-2 font-semibold text-ink no-underline">
          <ChevronLeft aria-hidden="true" size={20} strokeWidth={2.5} />
          {t('settings.backToToday')}
        </Link>
      </header>
      <main className="flex flex-1 flex-col gap-3.5 px-4 pb-4">
        <h1 className="display text-[38px]">{t('settings.title')}</h1>

        <OptionGroup title={t('settings.language')} className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((option) => (
            <button
              key={option}
              type="button"
              lang={option}
              aria-pressed={language === option}
              onClick={() => update({ language: option })}
              className="choice"
            >
              {LANGUAGE_LABELS[option]}
            </button>
          ))}
        </OptionGroup>

        <OptionGroup title={t('settings.theme')} className="flex flex-col gap-2">
          {THEMES.map((option) => {
            const selected = theme === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => update({ theme: option })}
                className="flex min-h-[60px] w-full items-center gap-3 rounded-xl bg-card px-3 py-2 text-left text-ink"
                style={{ border: selected ? '3px solid var(--c-accent)' : '2px solid var(--c-control)' }}
              >
                <span aria-hidden="true" className="flex shrink-0 overflow-hidden rounded-md border border-control">
                  {THEME_SWATCHES[option].map((color) => (
                    <span key={color} className="h-10 w-[22px]" style={{ background: color }} />
                  ))}
                </span>
                <span className="flex-1 text-[17px] font-bold">{t(`settings.themes.${option}`)}</span>
                {selected && <Check aria-hidden="true" size={24} strokeWidth={3} />}
              </button>
            );
          })}
        </OptionGroup>

        <OptionGroup title={t('settings.units')} className="grid grid-cols-2 gap-2">
          {UNITS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={unit === option}
              onClick={() => update({ unit: option })}
              className="choice"
            >
              {t(`settings.unitNames.${option}`)}
            </button>
          ))}
        </OptionGroup>
      </main>
    </>
  );
}
