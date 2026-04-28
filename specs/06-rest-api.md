# 06 — REST API

Tangerina's Flask routes (`flask_routes.py`) are control-plane endpoints separate from Discord. We re-host them as **Next.js route handlers** under `apps/bot/app/api/*`. Behavior is the same, but they call the voice worker over RPC instead of running things in-process.

## Mapping

| Method | Tangerina path             | Next.js path                                    | Auth     | Handler delegates to       |
| ------ | -------------------------- | ----------------------------------------------- | -------- | -------------------------- |
| GET    | `/health`                  | `/api/health`                                   | none     | local                      |
| POST   | `/enter-channel`           | `/api/voice/enter-channel`                      | API key  | `worker /voice/join`       |
| POST   | `/leave-channel`           | `/api/voice/leave-channel`                      | API key  | `worker /voice/leave`      |
| GET    | `/user/voice-channel`      | `/api/voice/user`                               | API key  | `worker /voice-channel`    |
| POST   | `/music/play`              | `/api/music/play`                               | API key  | `worker /music/play`       |
| POST   | `/music/stop`              | `/api/music/stop`                               | API key  | `worker /music/stop`       |
| POST   | `/music/skip`              | `/api/music/skip`                               | API key  | `worker /music/skip`       |
| POST   | `/music/pause`             | `/api/music/pause`                              | API key  | `worker /music/pause`      |
| POST   | `/music/resume`            | `/api/music/resume`                             | API key  | `worker /music/resume`     |
| POST   | `/music/volume`            | `/api/music/volume`                             | API key  | `worker /music/volume`     |
| GET    | `/music/queue`             | `/api/music/queue`                              | API key  | `worker /music/queue`      |
| POST   | `/music/spotify/play`      | `/api/music/spotify/play`                       | API key  | `worker /music/play` (source=spotify) |
| POST   | `/music/leave`             | `/api/music/leave`                              | API key  | `worker /voice/leave`      |
| POST   | `/tts/speak`               | `/api/tts/speak`                                | API key  | `worker /tts/speak` (provider=elevenlabs) |
| POST   | `/tts/piper/speak`         | `/api/tts/piper`                                | API key  | `worker /tts/speak` (provider=piper) |
| POST   | `/chatbot/message`         | `/api/chat`                                     | API key  | `ai SDK generateText` (no tools) |

Tangerina's `require_bot_ready` becomes a single `assertReady` middleware that proxies `worker /health` and 503s if not ready.

## Auth

Tangerina has no auth on these routes. We add a minimal `Authorization: Bearer ${API_KEY}` because the routes are now publicly reachable on a Vercel URL.

```ts
// apps/bot/app/api/_middleware.ts
export function assertApiKey(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${env.API_KEY}`) throw new Response('unauthorized', { status: 401 });
}
```

`/api/health` is the only unauthenticated endpoint.

## Validation

`zod` schemas per route. Reject with 400 + JSON `{ error, issues }`. Mirrors Tangerina's input validation behavior covered by `tests/integration/test_flask_routes.py`.

```ts
// apps/bot/app/api/music/play/route.ts
const Body = z.object({
  guildId: z.string().min(1),
  channelId: z.string().min(1),
  query: z.string().min(1).max(300),
  source: z.enum(['youtube','spotify']).optional(),
});

export async function POST(req: Request) {
  assertApiKey(req);
  const json = await req.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success) return Response.json({ error: 'invalid', issues: parsed.error.issues }, { status: 400 });
  const data = await worker.post('/worker/music/play', parsed.data);
  return Response.json(data);
}
```

## /api/chat (stateless chat)

Equivalent to Tangerina's `POST /chatbot/message` — runs the model **without** tools. Useful for n8n / external automations that just want raw chat.

```ts
// apps/bot/app/api/chat/route.ts
const Body = z.object({
  message: z.string().min(1),
  context: z.array(z.object({ role: z.enum(['user','assistant','system']), content: z.string() })).optional(),
});

export async function POST(req: Request) {
  assertApiKey(req);
  const { message, context } = Body.parse(await req.json());
  const result = await generateText({
    model: gateway(env.LLM_MODEL),
    system: persona({ ctx: { recent: [], semantic: [] } }),
    messages: [...(context ?? []), { role: 'user', content: message }],
  });
  return Response.json({ success: true, response: result.text });
}
```

## /api/health

```ts
// apps/bot/app/api/health/route.ts
export async function GET() {
  const w = await worker.get('/worker/health').catch(() => null);
  return Response.json({
    status: 'ok',
    bot_ready: Boolean(w?.ready),
    worker: w ?? { ready: false },
    version: env.APP_VERSION,
  }, { status: w?.ready ? 200 : 503 });
}
```

## Backward compatibility

For users porting from Tangerina, `apps/bot/app/api/_legacy.ts` re-exports old paths (`/health`, `/music/play`, etc.) as Next rewrites in `next.config.mjs`. Off by default, opt-in with `LEGACY_ROUTES=true`.

```js
// next.config.mjs
export default {
  async rewrites() {
    if (process.env.LEGACY_ROUTES !== 'true') return [];
    return [
      { source: '/health', destination: '/api/health' },
      { source: '/enter-channel', destination: '/api/voice/enter-channel' },
      { source: '/leave-channel', destination: '/api/voice/leave-channel' },
      { source: '/user/voice-channel', destination: '/api/voice/user' },
      { source: '/music/:action', destination: '/api/music/:action' },
      { source: '/music/spotify/play', destination: '/api/music/spotify/play' },
      { source: '/tts/speak', destination: '/api/tts/speak' },
      { source: '/tts/piper/speak', destination: '/api/tts/piper' },
      { source: '/chatbot/message', destination: '/api/chat' },
    ];
  },
};
```
