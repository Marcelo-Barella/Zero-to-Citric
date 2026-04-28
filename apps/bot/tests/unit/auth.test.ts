import { describe, expect, it, beforeEach } from 'vitest';
import { assertApiKey, assertAdminToken, assertCronSecret, AuthError } from '../../lib/auth';
import { resetEnvCache } from '../../lib/env';

function set(k: string, v?: string): void {
  resetEnvCache();
  if (v === undefined) delete (process.env as Record<string, string | undefined>)[k];
  else process.env[k] = v;
}

function req(authHeader?: string): Request {
  return new Request('http://localhost/x', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe('auth assertions', () => {
  beforeEach(() => {
    set('API_KEY', 'k');
    set('ADMIN_TOKEN', 'a');
    set('CRON_SECRET', 'c');
  });

  it('assertApiKey rejects missing/wrong tokens', () => {
    expect(() => assertApiKey(req())).toThrow(AuthError);
    expect(() => assertApiKey(req('Bearer wrong'))).toThrow(AuthError);
    expect(() => assertApiKey(req('Bearer k'))).not.toThrow();
  });

  it('assertAdminToken rejects missing/wrong tokens', () => {
    expect(() => assertAdminToken(req())).toThrow(AuthError);
    expect(() => assertAdminToken(req('Bearer a'))).not.toThrow();
  });

  it('assertCronSecret rejects missing/wrong tokens', () => {
    expect(() => assertCronSecret(req())).toThrow(AuthError);
    expect(() => assertCronSecret(req('Bearer c'))).not.toThrow();
  });

  it('returns 503 when env not configured', () => {
    set('API_KEY', undefined);
    let response: Response | null = null;
    try {
      assertApiKey(req('Bearer x'));
    } catch (err) {
      if (err instanceof AuthError) response = err.toResponse();
    }
    expect(response?.status).toBe(503);
  });
});
