# 08 — Deployment and Environment

## Two deploy targets

| Target          | Host                       | Why                                                  |
| --------------- | -------------------------- | ---------------------------------------------------- |
| `apps/bot`      | Vercel                     | Serverless Next.js + Chat SDK runtime + AI Gateway   |
| `apps/voice-worker` | Fly.io / Render / Railway | 24/7 Node process for Discord voice + ffmpeg/yt-dlp |

The hackathon submission is graded on Vercel; the voice worker is documented as an optional companion deployment that lights up music + STT + TTS features.

## Vercel project (`apps/bot`)

- Framework preset: Next.js
- Node runtime for any route that touches Postgres / Redis / worker (`export const runtime = 'nodejs'`).
- Cron: `vercel.json` with `/api/cron/memory-prune` daily.
- Env: see inventory below.

## Voice worker deploy (`apps/voice-worker`)

- Single Dockerfile (`apps/voice-worker/Dockerfile`).
- Includes `ffmpeg`, `yt-dlp`, optional `piper` and `whisper.cpp` binaries.
- Healthcheck on `/worker/health`.
- Fly.toml provided as the cheap default.

## Environment variable inventory

Grouped by who needs them. **bot** = `apps/bot` (Vercel). **worker** = `apps/voice-worker`. **shared** = both.

### Core (shared)

| Var                        | Default        | Used by   | Notes                                            |
| -------------------------- | -------------- | --------- | ------------------------------------------------ |
| `NODE_ENV`                 | `production`   | shared    |                                                  |
| `LOG_LEVEL`                | `info`         | shared    | Tangerina parity                                 |
| `BOT_LOCALE`               | `pt-BR`        | bot       |                                                  |
| `APP_VERSION`              | git sha        | shared    | Set by build                                     |

### Discord (Chat SDK adapter + worker)

| Var                        | Required | Used by | Notes                                                   |
| -------------------------- | -------- | ------- | ------------------------------------------------------- |
| `DISCORD_BOT_TOKEN`        | yes      | shared  | Same token used by adapter and worker                   |
| `DISCORD_APP_ID`           | yes      | bot     | Required by Chat SDK adapter                            |
| `DISCORD_PUBLIC_KEY`       | yes      | bot     | For interaction signature verification                  |
| `DISCORD_INTENTS`          | computed | worker  | At minimum: GuildMessages, MessageContent, GuildVoiceStates |

### LLM (AI Gateway)

| Var                  | Required | Used by | Notes                                                                |
| -------------------- | -------- | ------- | -------------------------------------------------------------------- |
| `AI_GATEWAY_API_KEY` | yes      | bot     | Single key for all providers via gateway                             |
| `LLM_MODEL`          | yes      | bot     | e.g. `anthropic/claude-sonnet-4-6`, `openai/gpt-5`, `google/gemini-2.5-pro` |
| `EMBEDDING_MODEL`    | no       | bot     | Default `openai/text-embedding-3-small`                              |

> Note: Tangerina's `MODEL_PROVIDER`, `OPENAI_API_KEY`, `ZHIPU_API_KEY`, `GEMINI_API_KEY` are **dropped** in favor of a single `AI_GATEWAY_API_KEY`. Document this clearly in README migration section.

### Memory

| Var                            | Required | Used by | Notes                                  |
| ------------------------------ | -------- | ------- | -------------------------------------- |
| `MEMORY_ENABLED`               | no       | bot     | default `false`                        |
| `MAX_RETRIEVAL_RESULTS`        | no       | bot     | default `10`                           |
| `MEMORY_SIMILARITY_THRESHOLD`  | no       | bot     | default `0.6`                          |
| `MEMORY_RETENTION_DAYS`        | no       | bot     | default `30`                           |
| `POSTGRES_URL`                 | yes (if memory on) | bot | Vercel Postgres / Neon                 |
| `KV_REST_API_URL`              | yes      | bot     | Upstash Redis (also used by Chat SDK state) |
| `KV_REST_API_TOKEN`            | yes      | bot     | Upstash Redis                          |

### Web search

| Var                        | Required | Used by | Notes                                  |
| -------------------------- | -------- | ------- | -------------------------------------- |
| `TAVILY_API_KEY`           | no       | bot     | Enables `WebSearch` tool               |
| `WEB_SEARCH_ENABLED`       | no       | bot     | default `true` if `TAVILY_API_KEY` set |

### Music

| Var                        | Required | Used by | Notes                              |
| -------------------------- | -------- | ------- | ---------------------------------- |
| `SPOTIFY_CLIENT_ID`        | no       | worker  |                                    |
| `SPOTIFY_CLIENT_SECRET`    | no       | worker  |                                    |
| `MAX_QUEUE_SIZE`           | no       | worker  | default `50`                       |

### TTS / STT

| Var                        | Required | Used by | Notes                                                 |
| -------------------------- | -------- | ------- | ----------------------------------------------------- |
| `TTS_PROVIDER`             | no       | worker  | `elevenlabs` (default) or `piper`                     |
| `ELEVEN_API_KEY`           | conditional | worker | when `TTS_PROVIDER=elevenlabs`                       |
| `ELEVEN_VOICE_ID`          | no       | worker  | default chosen voice                                  |
| `PIPER_SIDECAR_URL`        | no       | worker  | when `TTS_PROVIDER=piper`                             |
| `WHISPER_PROVIDER`         | no       | worker  | `zhipu`, `openai`, or `sidecar`. default `zhipu`      |
| `WHISPER_SIDECAR_URL`      | no       | worker  | required when `WHISPER_PROVIDER=sidecar`              |
| `OPENAI_API_KEY`           | conditional | worker | only when `WHISPER_PROVIDER=openai` (Whisper API)    |
| `ZHIPU_API_KEY`            | conditional | worker | only when `WHISPER_PROVIDER=zhipu`                   |

### Wake word

| Var                | Default      |
| ------------------ | ------------ |
| `WAKE_WORD`        | `tangerina`  |
| `WAKE_WINDOW_MS`   | `5000`       |
| `WAKE_DUCK_VOLUME` | `20`         |

### Integrations

| Var                        | Required | Used by | Notes                                  |
| -------------------------- | -------- | ------- | -------------------------------------- |
| `N8N_WEBHOOK_URL`          | no       | bot     | If set, fan-out is enabled             |

### Worker auth

| Var                        | Required | Used by | Notes                                  |
| -------------------------- | -------- | ------- | -------------------------------------- |
| `WORKER_BASE_URL`          | yes      | bot     | e.g. `https://tangerina-voice.fly.dev` |
| `WORKER_SHARED_SECRET`     | yes      | shared  | Bot signs requests with this           |

### Public REST API

| Var                | Required | Used by | Notes                            |
| ------------------ | -------- | ------- | -------------------------------- |
| `API_KEY`          | yes      | bot     | Bearer token for `/api/*`        |
| `LEGACY_ROUTES`    | no       | bot     | `true` enables Tangerina paths   |
| `ADMIN_TOKEN`      | yes (admin only) | bot | For `/api/memory/forget`     |

## Vercel project setup checklist

1. `vercel link` in `apps/bot/`.
2. Add Vercel Postgres + Vercel KV (Upstash Redis).
3. Add AI Gateway integration; copy `AI_GATEWAY_API_KEY`.
4. Set all required envs in Vercel dashboard (Production + Preview).
5. Push to main; Vercel deploys.
6. After first deploy, run `/api/admin/init-db` once to create `memories` table + `pgvector` extension.

## Voice worker setup checklist

1. `flyctl launch --no-deploy` from `apps/voice-worker/`.
2. `flyctl secrets set DISCORD_BOT_TOKEN=… SPOTIFY_CLIENT_ID=… SPOTIFY_CLIENT_SECRET=… ELEVEN_API_KEY=… WORKER_SHARED_SECRET=…` (etc.).
3. Optional: scale to 1 dedicated CPU + 1GB RAM for music transcoding headroom.
4. `flyctl deploy`.
5. Set `WORKER_BASE_URL` in Vercel to the resulting Fly URL.
