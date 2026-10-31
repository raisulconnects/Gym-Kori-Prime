import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PasswordField } from '../components/PasswordField';

export const MIN_PASSWORD_LENGTH = 8;

export function LoginScreen() {
  const { t } = useTranslation();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const isSignup = mode === 'signup';
  const title = isSignup ? t('auth.signUp') : t('auth.logIn');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isSignup && !name.trim()) return setError('auth.errorName');
    if (!email.trim()) return setError('auth.errorEmail');
    if (isSignup && password.length < MIN_PASSWORD_LENGTH) return setError('auth.errorWeakPassword');
    if (!password) return setError('auth.errorPassword');

    setError(null);
    setBusy(true);
    if (isSignup) {
      const result = await signUp(name, email, password);
      setError(result.error);
      setConfirmationSent(result.needsConfirmation);
    } else {
      setError((await signIn(email, password)).error);
    }
    setBusy(false);
  }

  if (confirmationSent) {
    return (
      <main className="flex flex-1 flex-col justify-center gap-4 px-6 py-8">
        <h1 className="display text-[36px]">{t('auth.checkEmailTitle')}</h1>
        <p className="m-0 text-base leading-normal break-words">{t('auth.checkEmailBody', { email: email.trim() })}</p>
        <button
          type="button"
          onClick={() => {
            setConfirmationSent(false);
            setMode('login');
            setPassword('');
          }}
          className="cta"
        >
          {t('auth.logIn')}
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-4 px-6 py-8">
      <div className="flex flex-col gap-1">
        <span className="text-[17px] font-bold text-accent">{t('app.name')}</span>
        <h1 className="display text-[42px]">{title}</h1>
      </div>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        {isSignup && (
          <label className="flex flex-col gap-1.5 text-[15px] font-semibold">
            {t('auth.name')}
            <input
              name="name"
              autoComplete="name"
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field"
            />
          </label>
        )}
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
        <PasswordField
          label={t('auth.password')}
          value={password}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          onChange={setPassword}
        />
        {isSignup && <p className="m-0 -mt-2 text-sm text-muted">{t('auth.passwordHelp')}</p>}
        {!isSignup && (
          <Link to="/forgot-password" className="-mt-2 flex min-h-11 w-fit items-center font-semibold text-accent">
            {t('auth.forgot')}
          </Link>
        )}
        {error && (
          <p role="alert" className="m-0 text-base font-semibold text-danger">
            {t(error)}
          </p>
        )}
        <button type="submit" disabled={busy} className="cta disabled:opacity-60">
          {busy ? t('auth.working') : title}
        </button>
      </form>
      <button
        type="button"
        onClick={() => {
          setMode(isSignup ? 'login' : 'signup');
          setError(null);
        }}
        className="min-h-11 border-0 bg-transparent text-[15px] font-medium text-ink"
      >
        {isSignup ? t('auth.toLogIn') : t('auth.toSignUp')}
      </button>
    </main>
  );
}
