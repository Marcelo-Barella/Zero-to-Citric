# 01 — Architecture

## Topology

```
                                 ┌──────────────────────────────┐
                                 │   Vercel deployment          │
                                 │                              │
   Discord  ◀── adapter ──▶  ┌───┤  Chat SDK runtime (Node)     │
   Slack*   ◀── adapter ──▶  │   │   bot.onNewMention …         │
   Teams*   ◀── adapter ──▶  │   │   tools (ai SDK)             │
   GitHub*  ◀── adapter ──▶  └──▶│   AI Gateway client          │
                                 │                              │
                                 │  Next.js route handlers      │
                                 │   /api/health                │
                                 │   /api/chat                  │
                                 │   /api/music/*               │
                                 │   /api/tts/*                 │
                                 │   /api/voice-channel         │
                                 │                              │
                                 │  Distributed state (Redis)   │
                                 └──────────┬───────────────────┘
                                            │
                                            ▼
                          ┌─────────────────────────────────┐
                          │   Voice worker (separate)       │
                          │   Long-lived process / container│
                          │   discord.js voice gateway      │
                          │   yt-dlp, Opus, PCM frames      │
                          │   STT + TTS pipeline            │
                          │   exposes mTLS RPC to Vercel    │
                          └─────────────────────────────────┘

* Adapters scaffolded but optional for the hackathon submission.
```

## Why two deployment targets

Vercel serverless functions cap at ~minutes and cannot keep a Discord voice gateway WebSocket open while streaming PCM frames. We split:

- **Vercel (serverless)** — chat, tools, REST API, AI Gateway calls, persistence, the entire `chat` SDK bot lifecycle for text-shaped events. This is what gets graded.
- **Voice worker (long-running)** — Fly.io / Render / Railway / DigitalOcean App. Holds the Discord voice connection, runs `yt-dlp`, decodes/encodes Opus, streams TTS audio. Talks to Vercel over a small RPC surface (`POST /worker/play`, `POST /worker/listen`, server-sent events for transcripts).

The Chat SDK bot runs on Vercel and treats the voice worker as a backing service — same way Tangerina's Flask process treats Piper / Whisper sidecars today.

## Package layout (monorepo, pnpm workspaces)

```
zero-to-citric/
├── package.json                    # workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── apps/
│   ├── bot/                        # Chat SDK + Next.js (Vercel target)
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── health/route.ts
│   │   │   │   ├── chat/route.ts
│   │   │   │   ├── music/[action]/route.ts
│   │   │   │   ├── tts/[provider]/route.ts
│   │   │   │   └── voice-channel/route.ts
│   │   │   └── (admin)/page.tsx    # tiny ops dashboard
│   │   ├── chat/
│   │   │   ├── bot.ts              # new Chat({ adapters, state })
│   │   │   ├── handlers/           # onNewMention, onSubscribedMessage, onReaction
│   │   │   └── adapters.ts
│   │   ├── ai/
│   │   │   ├── gateway.ts          # ai SDK + AI Gateway model resolver
│   │   │   ├── prompts/            # persona + system prompts
│   │   │   └── tools/              # one file per tool, exports ai.tool(...)
│   │   ├── memory/                 # pgvector + recent buffer
│   │   ├── search/                 # Tavily client
│   │   ├── webhooks/               # n8n hand-off
│   │   └── lib/                    # shared utils
│   └── voice-worker/               # long-running Node process
│       ├── src/
│       │   ├── index.ts            # discord.js client + RPC server
│       │   ├── music/              # yt-dlp + Spotify
│       │   ├── stt/                # Whisper / Zhipu ASR / Piper sidecar
│       │   ├── tts/                # ElevenLabs / Piper
│       │   └── wakeword.ts         # "tangerina" listener
│       ├── Dockerfile
│       └── fly.toml                # one of the cheapest 24/7 hosts
├── packages/
│   ├── shared-types/               # Zod schemas shared between bot and worker
│   ├── tools-contract/             # tool name → input → output types
│   └── persona/                    # tangerina_persona.md + loader
├── infra/
│   └── docker-compose.dev.yml      # Postgres+pgvector, Redis, voice worker
└── specs/
```

## Runtime contract: bot ↔ voice worker

A small typed RPC. All calls authenticated with a shared `WORKER_SHARED_SECRET` and rate-limited per guild.

| Method | Path                          | Purpose                                              |
| ------ | ----------------------------- | ---------------------------------------------------- |
| `POST` | `/worker/voice/join`          | `{ guildId, channelId }`                             |
| `POST` | `/worker/voice/leave`         | `{ guildId }`                                        |
| `POST` | `/worker/music/play`          | `{ guildId, channelId, query, source }`              |
| `POST` | `/worker/music/{stop,skip,…}` | mirrors Tangerina's music endpoints                  |
| `POST` | `/worker/tts/speak`           | `{ guildId, channelId, text, provider }`             |
| `POST` | `/worker/listen/start`        | begin wake-word listening loop                       |
| `GET`  | `/worker/health`              | `{ ready, voiceConnections, version }`               |
| `SSE`  | `/worker/events`              | streams `transcript`, `track-ended`, etc. to the bot |

The Chat SDK handlers on Vercel call these. The worker never calls the LLM — that stays on Vercel.

## State

- **Conversation state** — `chat` SDK distributed state, configured with `@chat-adapter/state-redis` against Upstash. The hub explicitly cites Redis vs `state-memory` as the choice point.
- **Long-term memory** — Postgres + `pgvector` extension via `@vercel/postgres` (or Neon). One `memories` table indexed by `(guild_id, channel_id, user_id)` plus an HNSW index on the embedding column.
- **Recent-interaction buffer** — Redis sorted set, mirrors Tangerina's per-`guild_channel_user` deque.

## Cross-cutting concerns

| Concern               | Decision                                                                                |
| --------------------- | --------------------------------------------------------------------------------------- |
| Logging               | `pino` JSON to stdout, structured fields `{guild_id, channel_id, user_id, tool}`        |
| Tracing               | OpenTelemetry exporter to Vercel observability when present, console otherwise          |
| Rate limiting         | Upstash Ratelimit, per `(guild_id, user_id)` for `onNewMention`                         |
| Secrets               | All in Vercel env. Voice worker reads its subset from its hosting platform's secrets    |
| Feature flags         | `FEATURE_*` env vars (memory, web search, n8n, music, voice listening) — all default ON if creds set, OFF otherwise (matches Tangerina behavior) |
| Locale                | `BOT_LOCALE=pt-BR` default. Persona file is the source of voice/tone                    |

## Performance budgets

- Mention → first model token: **< 1.5s p95** (AI Gateway claim, validate)
- Tool round-trip (no music): **< 2.5s p95**
- Memory retrieval: **< 250ms p95** for top-10 from `pgvector`
- Music command → audio start: **< 4s p95** for cached tracks, **< 10s** cold

## Open architectural questions

1. **`chat` SDK voice support** — the hub framing emphasizes text events. We treat voice as out-of-scope for the SDK and route it through the dedicated worker. Revisit when the SDK exposes a voice adapter.
2. **JSX cards** — the hub mentions JSX cards as a Chat SDK feature. We use them in `08` for music "now playing" cards on Discord, gated by adapter capability detection.
3. **Multi-platform scope** — Discord is mandatory for parity with Tangerina. Slack adapter is wired but not enabled by default.
