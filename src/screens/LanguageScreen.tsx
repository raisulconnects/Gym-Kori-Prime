import { useNavigate } from 'react-router-dom';
import type { Language } from '../preferences/preferences';
import { usePreferences } from '../preferences/PreferencesContext';

const OPTIONS: { value: Language; label: string }[] = [
  { value: 'bn', label: 'বাংলা' },
  { value: 'en', label: 'English' },
];

/** Shown in both languages because the user hasn't chosen one yet. */
export function LanguageScreen() {
  const { update } = usePreferences();
  const navigate = useNavigate();

  function choose(language: Language) {
    update({ language });
    navigate('/today', { replace: true });
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <h1 lang="bn" className="display text-[40px]">
          ভাষা বেছে নিন
        </h1>
        <p lang="en" className="m-0 text-xl leading-snug">
          Choose your language
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            lang={value}
            onClick={() => choose(value)}
            className="card min-h-[72px] text-2xl font-semibold text-ink"
          >
            {label}
          </button>
        ))}
      </div>
      <p className="m-0 text-[15px] leading-normal text-muted">
        <span lang="bn">আপনি পরে সেটিংস থেকে বদলাতে পারবেন।</span>
        <br />
        <span lang="en">You can change this later in Settings.</span>
      </p>
    </main>
  );
}
