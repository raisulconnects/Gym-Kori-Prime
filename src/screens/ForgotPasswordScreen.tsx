import { ChevronLeft } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return setError('auth.errorEmail');
    setError(null);
    setBusy(true);
    const result = await sendPasswordReset(email);
    setBusy(false);
    setError(result.error);
    setSent(!result.error);
  }

  return (
    <>
      <header className="px-2 pt-2.5 pb-0.5">
        <Link to="/login" className="flex min-h-11 w-fit items-center gap-0.5 px-2 font-semibold text-ink no-underline">
          <ChevronLeft aria-hidden="true" size={20} strokeWidth={2.5} />
          {t('auth.logIn')}
        </Link>
      </header>
      <main className="flex flex-1 flex-col gap-4 px-6 py-6">
        <h1 className="display text-[36px]">{t('auth.resetTitle')}</h1>
        {sent ? (
          <p role="status" className="m-0 text-base leading-normal break-words">
            {t('auth.resetSent', { email: email.trim() })}
          </p>
        ) : (
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <p className="m-0 text-base leading-normal text-muted">{t('auth.resetHelp')}</p>
            <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
              {t('auth.email')}
              <input
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="field"
              />
            </label>
            {error && (
              <p role="alert" className="m-0 text-base font-semibold text-danger">
                {t(error)}
              </p>
            )}
            <button type="submit" disabled={busy} className="cta disabled:opacity-60">
              {busy ? t('auth.working') : t('auth.sendReset')}
            </button>
          </form>
        )}
      </main>
    </>
  );
}
