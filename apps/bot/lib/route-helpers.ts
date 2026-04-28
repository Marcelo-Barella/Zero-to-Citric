import type { ZodTypeAny, z } from 'zod';
import { assertApiKey, assertContentType, AuthError } from './auth.js';
import { logger } from './logger.js';

export interface ProxyOptions<S extends ZodTypeAny> {
  schema: S;
  workerPath: string;
  method: 'GET' | 'POST';
  /** When true, the request body's keys are passed as query string instead. */
  asQuery?: boolean;
  /** Optional transform from validated body to worker payload. */
  transform?: (input: z.infer<S>) => Record<string, unknown>;
}

export async function proxyToWorker<S extends ZodTypeAny>(req: Request, opts: ProxyOptions<S>): Promise<Response> {
  const log = logger().child({ route: opts.workerPath });
  try {
    assertApiKey(req);
    if (opts.method === 'POST') assertContentType(req);
  } catch (err) {
    if (err instanceof AuthError) return err.toResponse();
    throw err;
  }
  let raw: unknown;
  if (opts.method === 'POST') {
    try {
      raw = await req.json();
    } catch {
      return Response.json({ error: 'invalid_json' }, { status: 400 });
    }
  } else {
    const url = new URL(req.url);
    raw = Object.fromEntries(url.searchParams.entries());
  }
  const parsed = opts.schema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 });
  }
  const payload = opts.transform ? opts.transform(parsed.data) : (parsed.data as Record<string, unknown>);
  const { voiceWorker } = await import('./voice-worker-client.js');
  if (opts.method === 'GET') {
    const r = await voiceWorker.get(
      opts.workerPath,
      payload as Record<string, string | number | boolean | undefined>,
    );
    if (!r.ok) {
      log.warn({ err: r.error }, 'worker error');
      const status = r.error === 'voice_disabled' ? 503 : 502;
      return Response.json({ error: r.error }, { status });
    }
    return Response.json(r.data);
  }
  const r = await voiceWorker.post(opts.workerPath, payload);
  if (!r.ok) {
    const status = r.error === 'voice_disabled' ? 503 : 502;
    return Response.json({ error: r.error }, { status });
  }
  return Response.json(r.data);
}

export function methodNotAllowed(): Response {
  return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
    status: 405,
    headers: { 'content-type': 'application/json', allow: 'POST' },
  });
}
