# 10 — Milestones

The build order. Each milestone is independently testable and demoable. The hackathon submission targets **M2** at minimum — that is when the bot speaks intelligently in Discord using the Chat SDK and tools. M3+ light up parity features.

## M0 — Skeleton (½ day)

- [ ] pnpm workspace, `apps/bot`, `apps/voice-worker`, `packages/persona`, `packages/shared-types`, `packages/tools-contract`.
- [ ] `apps/bot` Next.js + TypeScript bootstrapped.
- [ ] `pino` logging, `zod` env loader, basic `/api/health`.
- [ ] `vitest` set up, one passing test per package.
- [ ] CI green.

**Demo**: `pnpm test` is green, `pnpm dev` serves `/api/health`.

## M1 — Hello, Chat SDK (1 day)

- [ ] Install `chat`, `@chat-adapter/discord`, `@chat-adapter/state-redis`.
- [ ] `apps/bot/chat/bot.ts` constructs `new Chat({ adapters: [discord()], state: redis() })`.
- [ ] `onNewMention` replies "olá" with persona loaded but no tools and no memory.
- [ ] AI Gateway wired through `ai` SDK, default model from `LLM_MODEL`.
- [ ] Persona file shipped, persona snapshot test passing.

**Demo**: Mention bot in Discord → bot replies in pt-BR with persona voice.

## M2 — Tools, Search, n8n (2 days) — **Hackathon submission target**

- [ ] All 16 tools implemented per `03-tools.md`. The voice/music/TTS tools call the worker; if `WORKER_BASE_URL` is unset, they return a structured "voice features disabled" error so text-only deploys still work.
- [ ] `WebSearch` (Tavily) wired and gated by env.
- [ ] n8n webhook fan-out wired and gated by env.
- [ ] Stateless `/api/chat` endpoint working (Tangerina parity).
- [ ] Tool unit tests + handler integration tests passing.

**Demo**: in Discord, "tangerina, qual é o clima em Lisboa hoje?" triggers `WebSearch`. "tangerina, liste os canais" triggers `GET_Canais` (which actually works on text adapter). Music tools return "voice worker offline" if not deployed yet.

## M3 — Memory + Worker MVP (2 days)

- [ ] Postgres + pgvector provisioned. `memories` table + indexes.
- [ ] `rememberTurn` + `retrieveContext` end-to-end. Recent + semantic block injected in persona prompt.
- [ ] Cron prune working.
- [ ] `apps/voice-worker` MVP: discord.js client, voice join/leave, music play (YouTube), queue, volume.
- [ ] RPC + SSE plumbing live. Bot calls worker for `EnterChannel`, `MusicPlay`, `MusicSkip`, `MusicVolume`.

**Demo**: bot remembers a fact across messages; bot joins a voice channel and plays a YouTube link from a chat message.

## M4 — Voice STT/TTS + Wake word (2 days)

- [ ] TTS pipeline (ElevenLabs default, Piper opt-in) inside worker.
- [ ] STT pipeline (Zhipu / OpenAI / sidecar) inside worker.
- [ ] Wake word `tangerina` with 5s listen window and music ducking.
- [ ] Worker emits `transcript` SSE; bot receives, runs full chat handler with the transcript as user message.
- [ ] Spotify resolver path.

**Demo**: say "tangerina, toca tropicália" while music is playing → music ducks, bot transcribes, bot calls `MusicPlay`, new track plays.

## M5 — REST API parity + admin (1 day)

- [ ] All Next route handlers per `06-rest-api.md` deployed.
- [ ] `LEGACY_ROUTES` rewrites tested against Tangerina's existing clients.
- [ ] Admin endpoints `/api/memory/forget` + minimal admin page.
- [ ] Playwright smoke for admin page.

**Demo**: cURL the legacy `/music/play` URL on the new deploy; same JSON response shape as Tangerina.

## M6 — Polish + Submission (1 day)

- [ ] Vercel deployment URL public.
- [ ] Voice worker deployed to Fly.
- [ ] README with setup, env, demo gif/video.
- [ ] Notion documentation page updated with deployed URLs.
- [ ] Submission checklist filled per Vercel hackathon rules (when those land).

## Hard cuts (out of scope for hackathon)

- Slack / Teams / GitHub adapters (wired but not enabled).
- Multi-server fan-out / sharding.
- Voice diarization (per-speaker transcripts).
- Custom MCP server hosting (could be added in a v2).

## Risk register

| Risk                                                     | Likelihood | Mitigation                                                          |
| -------------------------------------------------------- | ---------- | ------------------------------------------------------------------- |
| `chat` SDK API differences vs hub examples               | medium     | Pin a known good version; sanity-check at M1.                       |
| Vercel function timeouts on long tool chains             | low        | We bound `stepCountIs(10)`; long voice operations live on worker.   |
| AI Gateway model availability for `claude-sonnet-4-6`    | low        | Fall back to `openai/gpt-5` via env switch.                         |
| yt-dlp breakage on YouTube format changes                | medium     | Pin yt-dlp version, add nightly CI to refresh.                      |
| Wake-word false positives (the literal word "tangerina") | medium     | Require >300ms silence before+after, low-pass filter, dedupe window.|
