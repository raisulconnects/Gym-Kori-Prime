const MESSAGE_BY_CODE: Record<string, string> = {
  invalid_credentials: 'auth.errorCredentials',
  email_not_confirmed: 'auth.errorNotConfirmed',
  user_already_exists: 'auth.errorExists',
  email_exists: 'auth.errorExists',
  weak_password: 'auth.errorWeakPassword',
  same_password: 'auth.errorSamePassword',
  email_address_invalid: 'auth.errorEmail',
  validation_failed: 'auth.errorEmail',
  over_email_send_rate_limit: 'auth.errorRateLimit',
  over_request_rate_limit: 'auth.errorRateLimit',
};

interface ErrorLike {
  code?: string;
  name?: string;
  status?: number;
}

/** Turns a Supabase error into a translation key the user can act on. */
export function authErrorKey(error: ErrorLike): string {
  const known = error.code ? MESSAGE_BY_CODE[error.code] : undefined;
  if (known) return known;
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return 'auth.errorNetwork';
  return 'auth.errorGeneric';
}
