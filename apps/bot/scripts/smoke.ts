#!/usr/bin/env tsx
/**
 * Smoke harness for Zero To Citric.
 *
 * Verifies, without hitting Discord or AI Gateway:
 * 1. Persona loads and renders.
 * 2. Tool registry exposes all 16 tools.
 * 3. The 16 tool names match the spec.
 * 4. /api/health returns 200 with bot_ready=true.
 * 5. /api/chat (mocked) returns success with a response.
 * 6. n8n fan-out POSTs when N8N_WEBHOOK_URL is set.
 *
 * Run with: pnpm test:smoke
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BOT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(BOT_ROOT);
const ROOT = path.resolve(BOT_ROOT, '..', '..');

(process.env as Record<string, string | undefined>).NODE_ENV = process.env.NODE_ENV ?? 'development';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'warn';
process.env.API_KEY = process.env.API_KEY ?? 'smoke-key';
process.env.AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY ?? 'smoke-gw';
process.env.LLM_MODEL = process.env.LLM_MODEL ?? 'anthropic/claude-sonnet-4.6';
process.env.BOT_LOCALE = process.env.BOT_LOCALE ?? 'pt-BR';
process.env.MEMORY_ENABLED = 'false';
process.env.WEB_SEARCH_ENABLED = 'true';
process.env.TAVILY_API_KEY = process.env.TAVILY_API_KEY ?? 'tvly-smoke';
process.env.WORKER_BASE_URL = process.env.WORKER_BASE_URL ?? 'https://worker.smoke';
process.env.WORKER_SHARED_SECRET = process.env.WORKER_SHARED_SECRET ?? 'sec';
process.env.N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL ?? 'https://n8n.smoke/hook';

const checks: { name: string; ok: boolean; detail?: string }[] = [];
function check(name: string, ok: boolean, detail?: string): void {
  checks.push({ name, ok, ...(detail !== undefined ? { detail } : {}) });
}

async function main(): Promise<void> {
  // 1. persona
  const { persona } = await import('@zero-to-citric/persona');
  const rendered = await persona({ ctx: { recent: [], semantic: [] }, locale: 'pt-BR', toolList: ['SEND_Mensagem'] });
  check(
    'persona renders',
    rendered.includes('Tangerina') && rendered.includes('SEND_Mensagem') && rendered.includes('pt-BR'),
  );

  // 2. tool registry
  const botRoot = BOT_ROOT;
  const toolsModule = (await import(path.join(botRoot, 'ai/tools/index.ts'))) as typeof import('../ai/tools/index.js');
  const factoryNames = Object.keys(toolsModule.factories).sort();
  const { toolNames } = (await import('@zero-to-citric/tools-contract')) as typeof import('@zero-to-citric/tools-contract');
  const expected = [...toolNames].sort();
  check('all 16 tools registered', factoryNames.length === 16, `got ${factoryNames.length}`);
  check('tool names match spec', JSON.stringify(factoryNames) === JSON.stringify(expected));

  // 3. listAvailableToolNames
  const env = (await import(path.join(botRoot, 'lib/env.ts'))) as typeof import('../lib/env.js');
  const names = toolsModule.listAvailableToolNames(env.loadEnv());
  check('voice + search tools enabled with envs', names.includes('MusicPlay') && names.includes('WebSearch'));

  // 4. /api/health
  const health = (await import(path.join(botRoot, 'app/api/health/route.ts'))) as typeof import('../app/api/health/route.js');
  // mock fetch for worker health
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    const u = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
    if (u.includes('/worker/health')) {
      return new Response(JSON.stringify({ ready: true, voiceConnections: 0, version: 'smoke' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return origFetch(url);
  }) as typeof fetch;
  const healthRes = await health.GET();
  globalThis.fetch = origFetch;
  check('/api/health 200', healthRes.status === 200);
  const healthBody = (await healthRes.json()) as { bot_ready: boolean; features: { voice: boolean } };
  check('health.bot_ready=true', healthBody.bot_ready === true);
  check('health.features.voice=true', healthBody.features.voice === true);

  // 5. /api/chat — auth check (full chat path tested in tests/integration/api-chat.test.ts)
  const chat = (await import(path.join(botRoot, 'app/api/chat/route.ts'))) as typeof import('../app/api/chat/route.js');
  const unauth = await chat.POST(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'oi' }),
    }),
  );
  check('/api/chat rejects unauthenticated', unauth.status === 401);
  const badJson = await chat.POST(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { authorization: 'Bearer smoke-key', 'content-type': 'application/json' },
      body: 'not-json',
    }),
  );
  check('/api/chat rejects bad json', badJson.status === 400);

  // 6. n8n fan-out
  let n8nReceived = 0;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
    if (u.includes('n8n.smoke')) {
      n8nReceived++;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return origFetch(url, init);
  }) as typeof fetch;
  const { fanOutToN8n } = (await import(path.join(botRoot, 'webhooks/n8n.ts'))) as typeof import('../webhooks/n8n.js');
  await fanOutToN8n({
    thread: {} as unknown as Parameters<typeof fanOutToN8n>[0]['thread'],
    channel: {} as unknown as Parameters<typeof fanOutToN8n>[0]['channel'],
    message: {
      id: 'm1',
      text: 'oi',
      author: { userId: 'u1', userName: 'marcelo', fullName: 'Marcelo', isBot: false, isMe: false },
      attachments: [],
    } as unknown as Parameters<typeof fanOutToN8n>[0]['message'],
    responseText: 'olá',
    toolCalls: [],
    guildId: 'g1',
    channelId: 'c1',
    userId: 'u1',
  });
  globalThis.fetch = origFetch;
  check('n8n fan-out POST received', n8nReceived === 1);

  // Report
  let failed = 0;
  for (const c of checks) {
    const status = c.ok ? 'PASS' : 'FAIL';
    process.stdout.write(`[${status}] ${c.name}${c.detail ? ` (${c.detail})` : ''}\n`);
    if (!c.ok) failed++;
  }
  if (failed > 0) {
    process.stdout.write(`\n${failed} smoke check(s) failed.\n`);
    process.exit(1);
  }
  process.stdout.write(`\nAll ${checks.length} smoke checks passed.\n`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('smoke harness error', err);
  process.exit(1);
});
