# Zero To Citric

Tangerina re-platformed on the Vercel Chat SDK. A Brazilian-Portuguese-first
Discord bot with text, music, voice (TTS + STT + wake word), web search, long-term
memory and a 16-tool function-calling surface.

The repo is a pnpm monorepo with two deploy targets: `apps/bot` runs on Vercel
(Next.js + Chat SDK + AI Gateway), and `apps/voice-worker` is a long-running Node
process (Fly.io / Render / Railway) that holds the Discord voice gateway open.

## Status

| Milestone | Scope                                                              | State |
| --------- | ------------------------------------------------------------------ | ----- |
| M0        | Workspace skeleton, CI, health endpoints                           | done  |
| M1        | Chat SDK + AI Gateway + persona reply                              | done  |
| M2        | All 16 tools, web search, n8n, `/api/chat`                         | done  |
| M3        | pgvector memory, voice worker MVP                                  | done  |
| M4        | TTS / STT routers, wake word matcher, Spotify resolver             | done  |
| M5        | Full REST API parity + admin page + observability + security       | done  |
| M6        | Polish + deploy walkthrough                                        | done  |

## Architecture

```
                Discord
                   │
         (HTTP Interactions)
                   │
                   ▼
   Vercel  ┌───────────────────────────┐         ┌────────────────────┐
   ──────▶ │ apps/bot                  │  RPC ─▶ │ apps/voice-worker  │
           │ ┌──────────────────────┐  │         │ Fastify + discord  │
           │ │ Chat SDK runtime     │  │         │ js + ffmpeg/yt-dlp │
           │ │ AI Gateway client    │  │ ◀── SSE │ ElevenLabs / Piper │
           │ │ 16 tools (ai SDK)    │  │         │ Whisper / Zhipu    │
           │ └──────────────────────┘  │         └────────────────────┘
           │ Next.js route handlers    │
           │ /api/*                    │
           │ /api/webhooks/discord     │
           │ /api/discord/gateway cron │
           └────┬───────────┬──────────┘
                │           │
                ▼           ▼
        Postgres+pgvector  Upstash Redis
        (long-term memory) (state, ratelimit)
```

## Quickstart (local)

Requires Node 22+ and pnpm 10+.

```bash
pnpm install
cp .env.example .env.local             # fill in tokens
pnpm check-env                         # validates env
pnpm test                              # vitest (bot + worker + packages)
pnpm test:smoke                        # smoke harness, no Discord/AI Gateway
pnpm build                             # next build + tsc for worker
```

To run dependencies locally (Postgres + Redis + worker):

```bash
docker compose up -d postgres redis
docker compose up voice-worker          # optional, requires DISCORD_BOT_TOKEN
```

To run the bot:

```bash
pnpm --filter "@zero-to-citric/bot" dev
# in another shell:
pnpm --filter "@zero-to-citric/voice-worker" dev
```

## Environment

See `.env.example` for the full list. Spec source: `specs/08-deployment-and-env.md`.

### Mandatory in production

| Variable | Used by | Notes |
|---|---|---|
| `DISCORD_BOT_TOKEN` | bot + worker | Same token for adapter and worker |
| `DISCORD_APPLICATION_ID` | bot | Auto-detected by `@chat-adapter/discord` |
| `DISCORD_PUBLIC_KEY` | bot | Webhook signature verification |
| `AI_GATEWAY_API_KEY` | bot | Single key for all model providers |
| `LLM_MODEL` | bot | Default `anthropic/claude-sonnet-4.6` |
| `API_KEY` | bot | Bearer token for `/api/*` |
| `CRON_SECRET` | bot | Secures `/api/discord/gateway` and cron prune |

### Optional

Memory: `MEMORY_ENABLED=true` requires `POSTGRES_URL`, `KV_REST_API_URL`,
`KV_REST_API_TOKEN`. Defaults: 30-day retention, 0.6 cosine threshold, top-10
results, `openai/text-embedding-3-small` embeddings.

Web search: set `TAVILY_API_KEY`. Disable with `WEB_SEARCH_ENABLED=false`.

n8n fan-out: set `N8N_WEBHOOK_URL`.

Voice worker: set `WORKER_BASE_URL` (e.g. `https://tangerina-voice.fly.dev`) and
`WORKER_SHARED_SECRET`. Without them, voice tools return `voice_disabled`.

Worker-side: `SPOTIFY_CLIENT_ID/SECRET`, `ELEVEN_API_KEY`, `ELEVEN_VOICE_ID`,
`PIPER_SIDECAR_URL`, `WHISPER_PROVIDER` (zhipu/openai/sidecar) and the matching
provider key. Wake word config: `WAKE_WORD`, `WAKE_WINDOW_MS`,
`WAKE_DUCK_VOLUME`.

Admin: `ADMIN_TOKEN` for `/api/memory/forget` and `/api/admin/init-db`.

Legacy compatibility: `LEGACY_ROUTES=true` enables Tangerina's original Flask
paths (`/health`, `/music/play`, etc.) as Next rewrites.

## Tools

The 16 function-calling tools (mirroring Tangerina's `build_tools_schema`) live
in `apps/bot/ai/tools/`:

```
GET_Canais            GET_UserVoiceChannel  SEND_Mensagem        EnterChannel
LeaveChannel          MusicPlay             MusicStop            MusicSkip
MusicPause            MusicResume           MusicVolume          GET_MusicQueue
MusicSpotifyPlay      MusicLeave            TTSSpeak             WebSearch
```

`SEND_Mensagem` is the only path the model has to write to a Discord channel.
All voice tools call the worker over signed RPC. `WebSearch` is gated by
`TAVILY_API_KEY`. Each tool's input is validated with Zod; return shape is
`{ok:true, data}` or `{ok:false, error}`.

## REST API

Full mapping in `specs/06-rest-api.md`. All routes require `Authorization: Bearer
$API_KEY` except `/api/health` (public) and `/api/webhooks/discord` (Discord
ed25519 signature).

```
GET  /api/health
POST /api/chat
POST /api/voice/enter-channel
POST /api/voice/leave-channel
GET  /api/voice/user
POST /api/music/{play,stop,skip,pause,resume,volume,leave,spotify/play}
GET  /api/music/queue
POST /api/tts/{speak,piper}
POST /api/memory/forget                (admin token)
POST /api/admin/init-db                (admin token)
GET  /api/cron/memory-prune            (cron secret)
POST /api/webhooks/discord             (Discord signature)
GET  /api/discord/gateway              (cron secret)
```

Set `LEGACY_ROUTES=true` to also expose the original Tangerina paths
(`/health`, `/music/play`, `/chatbot/message`, etc.) as Next rewrites.

## Deploying

### Bot to Vercel

1. `vercel link` from `apps/bot/`.
2. Add Vercel KV (Upstash Redis), Vercel Postgres or Neon, AI Gateway integration.
3. Set required envs (see above).
4. Push to `main`. Vercel deploys.
5. After first deploy, with `MEMORY_ENABLED=true`, run:
   ```bash
   curl -X POST -H "authorization: Bearer $ADMIN_TOKEN" \
        https://your-deployment.vercel.app/api/admin/init-db
   ```
6. Discord developer portal: set Interactions Endpoint URL to
   `https://your-deployment.vercel.app/api/webhooks/discord`. Discord PINGs to
   verify; if you see a 401 in logs, re-check `DISCORD_PUBLIC_KEY`.
7. Vercel cron `*/9 * * * *` keeps the Discord gateway WebSocket open via
   `/api/discord/gateway`. The cron schedule is in `vercel.json`.

### Voice worker to Fly.io

1. `flyctl launch --no-deploy` from `apps/voice-worker/` (rename `app` in
   `fly.toml` if you want a different name).
2. Set secrets:
   ```bash
   flyctl secrets set \
     DISCORD_BOT_TOKEN=... \
     WORKER_SHARED_SECRET=... \
     SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... \
     ELEVEN_API_KEY=... ELEVEN_VOICE_ID=... \
     OPENAI_API_KEY=... ZHIPU_API_KEY=... \
     WHISPER_PROVIDER=zhipu TTS_PROVIDER=elevenlabs
   ```
3. `flyctl deploy`.
4. In Vercel, set `WORKER_BASE_URL=https://<your-app>.fly.dev` and
   `WORKER_SHARED_SECRET` to the same secret.

The worker's Dockerfile bundles `ffmpeg` and a pinned `yt-dlp` (`2025.10.22`).

## Tests

```bash
pnpm test           # vitest across all packages
pnpm test:smoke     # smoke harness (no Discord, no Gateway)
pnpm typecheck      # tsc across all packages
pnpm build          # next build + tsc
```

Specific suites:

- `packages/persona/tests/persona.test.ts` — persona snapshot
- `apps/bot/tests/unit/tools/*.test.ts` — tool registry + policy
- `apps/bot/tests/unit/{auth,env,search-tavily,voice-worker-client,health}.test.ts`
- `apps/bot/tests/integration/api-{chat,music}.test.ts` — REST routes
- `apps/bot/tests/integration/memory.test.ts` — pgvector via testcontainers (skipped if no Docker)
- `apps/voice-worker/tests/{queue,wakeword,spotify,tts-router,stt-router,stt-wav,health}.test.ts`

CI (`.github/workflows/test.yml`) runs all of these on every push.

## Migration from Tangerina (Python)

| Tangerina env | Zero To Citric env | Notes |
|---|---|---|
| `MODEL_PROVIDER` + `OPENAI_API_KEY`/`ZHIPU_API_KEY`/`GEMINI_API_KEY` | `AI_GATEWAY_API_KEY` + `LLM_MODEL` | One key, hundreds of models |
| `EMBEDDING_PROVIDER` + `OPENAI_EMBEDDING_MODEL` + `SENTENCE_TRANSFORMER_MODEL` | `EMBEDDING_MODEL` | Default `openai/text-embedding-3-small` |
| `CHROMADB_PATH` | `POSTGRES_URL` + `KV_REST_API_URL/TOKEN` | pgvector + Upstash |
| `LISTEN_ADDR=0.0.0.0:5000` | Vercel route handlers | All 16 Flask paths preserved with `LEGACY_ROUTES=true` |

There is a one-shot migrator at `apps/bot/scripts/import-chromadb.ts` (skeleton)
for users who want to move their existing Chroma store to pgvector.

## Repository layout

```
zero-to-citric/
├── apps/
│   ├── bot/                # Vercel target: Next.js + Chat SDK + AI Gateway
│   │   ├── app/api/...     # 24 route handlers (incl. legacy rewrites)
│   │   ├── chat/           # Chat SDK bot, adapters, handlers
│   │   ├── ai/             # gateway client, persona prompt, 16 tool factories
│   │   ├── memory/         # pgvector + Redis recent buffer
│   │   ├── search/         # Tavily client
│   │   ├── webhooks/       # n8n fan-out
│   │   ├── lib/            # env, logger, OTEL, auth, ratelimit, RPC client
│   │   ├── scripts/        # smoke, check-env, init-db
│   │   └── tests/          # vitest unit + integration
│   └── voice-worker/       # Fastify + discord.js + ffmpeg/yt-dlp
│       ├── src/
│       │   ├── rpc/        # /worker/* routes + SSE
│       │   ├── voice/      # connection registry, listen pipeline
│       │   ├── music/      # queue, youtube, spotify, player
│       │   ├── tts/        # elevenlabs, piper, play
│       │   ├── stt/        # openai, zhipu, sidecar, wav
│       │   └── wakeword.ts # matcher + session manager
│       ├── Dockerfile      # node:22 + ffmpeg + yt-dlp
│       └── fly.toml
├── packages/
│   ├── persona/            # tangerina_persona.md + loader
│   ├── shared-types/       # zod RPC schemas + types
│   └── tools-contract/     # 16 tool name -> input/output schemas
├── infra/postgres/init.sql
├── docker-compose.yml      # local dev stack
├── vercel.json             # crons + function settings
├── specs/                  # canonical product specs (00..10)
└── .github/workflows/test.yml
```

## Specs

Source of truth lives in `specs/`. The Notion master page "Zero To Citric"
mirrors the spec set as a human-readable index.

## License

MIT.
