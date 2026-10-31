import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function PasswordField({
  label,
  value,
  autoComplete,
  onChange,
}: {
  label: string;
  value: string;
  autoComplete: 'current-password' | 'new-password';
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 text-[15px] font-semibold">
      <label htmlFor={autoComplete}>{label}</label>
      <div className="relative">
        <input
          id={autoComplete}
          name="password"
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="field pr-[76px]"
        />
        <button
          type="button"
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
          className="absolute top-1 right-1 h-11 min-w-16 border-0 bg-transparent text-[15px] font-semibold text-[var(--c-field-text)]"
        >
          {visible ? t('auth.hide') : t('auth.show')}
        </button>
      </div>
    </div>
  );
}
