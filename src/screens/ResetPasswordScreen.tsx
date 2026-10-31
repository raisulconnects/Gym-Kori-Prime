import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PasswordField } from '../components/PasswordField';
import { MIN_PASSWORD_LENGTH } from './LoginScreen';

/** Opened from the link in a password reset email, which signs the user in. */
export function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) return setError('auth.errorWeakPassword');
    setError(null);
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (result.error) return setError(result.error);
    navigate('/today', { replace: true });
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-4 px-6 py-8">
      <h1 className="display text-[36px]">{t('auth.newPasswordTitle')}</h1>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <PasswordField
          label={t('auth.newPassword')}
          value={password}
          autoComplete="new-password"
          onChange={setPassword}
        />
        <p className="m-0 -mt-2 text-sm text-muted">{t('auth.passwordHelp')}</p>
        {error && (
          <p role="alert" className="m-0 text-base font-semibold text-danger">
            {t(error)}
          </p>
        )}
        <button type="submit" disabled={busy} className="cta disabled:opacity-60">
          {busy ? t('auth.working') : t('auth.savePassword')}
        </button>
      </form>
    </main>
  );
}
