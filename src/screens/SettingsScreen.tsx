import { Check, ChevronLeft } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useActiveWorkout } from '../data/hooks';
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

function ProfileCard() {
  const { t } = useTranslation();
  const { email, displayName, updateDisplayName } = useAuth();
  const [name, setName] = useState(displayName);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // The saved name can arrive after the screen opens.
  useEffect(() => setName(displayName), [displayName]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setMessage({ text: t('auth.errorName'), failed: true });
    setBusy(true);
    const { error } = await updateDisplayName(name);
    setBusy(false);
    setMessage(error ? { text: t(error), failed: true } : { text: t('settings.nameSaved'), failed: false });
  }

  return (
    <section className="card flex flex-col gap-2.5 p-4">
      <h2 className="section-label">{t('settings.profile')}</h2>
      <form noValidate onSubmit={save} className="flex flex-col gap-2.5">
        <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
          {t('auth.name')}
          <span className="flex gap-2">
            <input
              name="name"
              autoComplete="name"
              maxLength={60}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setMessage(null);
              }}
              className="field min-w-0 flex-1"
            />
            <button type="submit" disabled={busy || name === displayName} className="small-action disabled:opacity-50">
              {t('common.save')}
            </button>
          </span>
        </label>
        {message && (
          <p role={message.failed ? 'alert' : 'status'} className="m-0 text-[15px] font-semibold">
            {message.text}
          </p>
        )}
      </form>
      <div className="flex flex-col text-[15px]">
        <span className="font-semibold">{t('auth.email')}</span>
        <span lang="en" className="break-words text-muted">
          {email}
        </span>
      </div>
    </section>
  );
}

export function SettingsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { language, theme, unit, update } = usePreferences();
  const { signOut, deleteAccount } = useAuth();
  const active = useActiveWorkout();
  const [error, setError] = useState<string | null>(null);

  async function logOut() {
    if (active && !window.confirm(t('settings.confirmLogOutWorkout'))) return;
    await signOut();
    navigate('/login', { replace: true });
  }

  async function removeAccount() {
    if (!window.confirm(t('settings.confirmDelete'))) return;
    setError(null);
    const result = await deleteAccount();
    if (result.error) setError(result.error);
    else navigate('/login', { replace: true });
  }

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

        <ProfileCard />

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

        <button type="button" onClick={logOut} className="choice mt-2 min-h-12">
          {t('settings.logOut')}
        </button>
        {error && (
          <p role="alert" className="m-0 text-base font-semibold text-danger">
            {t(error)}
          </p>
        )}
        <button
          type="button"
          onClick={removeAccount}
          className="mt-4 min-h-12 border-0 bg-transparent text-base font-bold text-danger"
        >
          {t('settings.deleteAccount')}
        </button>
      </main>
    </>
  );
}
