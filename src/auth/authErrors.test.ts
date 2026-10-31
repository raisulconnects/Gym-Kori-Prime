import { describe, expect, it } from 'vitest';
import { authErrorKey } from './authErrors';

describe('authErrorKey', () => {
  it('explains known problems', () => {
    expect(authErrorKey({ code: 'invalid_credentials' })).toBe('auth.errorCredentials');
    expect(authErrorKey({ code: 'email_not_confirmed' })).toBe('auth.errorNotConfirmed');
    expect(authErrorKey({ code: 'over_email_send_rate_limit' })).toBe('auth.errorRateLimit');
  });

  it('recognizes having no connection', () => {
    expect(authErrorKey({ name: 'AuthRetryableFetchError' })).toBe('auth.errorNetwork');
    expect(authErrorKey({ status: 0 })).toBe('auth.errorNetwork');
  });

  it('falls back to a general message', () => {
    expect(authErrorKey({ code: 'something_new' })).toBe('auth.errorGeneric');
    expect(authErrorKey({})).toBe('auth.errorGeneric');
  });
});
