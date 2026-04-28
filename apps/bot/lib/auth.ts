import { loadEnv } from './env.js';

export class AuthError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
  toResponse(): Response {
    return new Response(JSON.stringify({ error: this.message }), {
      status: this.status,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export function assertApiKey(req: Request): void {
  const env = loadEnv();
  if (!env.API_KEY) throw new AuthError(503, 'api_key_not_configured');
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${env.API_KEY}`;
  if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) {
    throw new AuthError(401, 'unauthorized');
  }
}

export function assertAdminToken(req: Request): void {
  const env = loadEnv();
  if (!env.ADMIN_TOKEN) throw new AuthError(503, 'admin_token_not_configured');
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${env.ADMIN_TOKEN}`;
  if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) {
    throw new AuthError(401, 'unauthorized');
  }
}

export function assertCronSecret(req: Request): void {
  const env = loadEnv();
  if (!env.CRON_SECRET) throw new AuthError(503, 'cron_secret_not_configured');
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${env.CRON_SECRET}`;
  if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) {
    throw new AuthError(401, 'unauthorized');
  }
}

export function assertContentType(req: Request, type: string = 'application/json'): void {
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.toLowerCase().includes(type)) throw new AuthError(415, 'unsupported_media_type');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
