# 09 — Testing

Tangerina has `pytest` unit/integration suites. We mirror the spirit (same coverage targets) on the Node/TS side with `vitest` plus a small Playwright pack for the admin page.

## Tools

- **Vitest** — unit + integration. Native ESM, fast, watch-friendly.
- **MSW** — HTTP mocking for AI Gateway / Tavily / worker RPC.
- **`@testcontainers/postgresql`** + `pgvector` image — integration tests for memory.
- **Playwright** — admin page smoke + one Discord-via-MSW e2e flow.
- **Tilt-style harness** — `pnpm dev:e2e` brings up Postgres, Redis, mock worker, and a fake Chat SDK transport.

## Coverage parity with Tangerina

Mapping `tests/` from Tangerina to ours:

| Tangerina test                                    | Equivalent here                                            |
| ------------------------------------------------- | ---------------------------------------------------------- |
| `tests/integration/test_flask_routes.py`          | `apps/bot/app/api/**/*.test.ts` (route handlers)            |
| `tests/integration/test_memory_chromadb.py`       | `apps/bot/memory/*.test.ts` (Postgres + pgvector container) |
| `tests/unit/test_memory_manager.py`               | same suite, unit slice                                      |
| `tests/unit/test_model_helper.py`                 | `apps/bot/ai/tools/*.test.ts` + `apps/bot/chat/handlers/*.test.ts` |
| `tests/unit/test_music_service.py`                | `apps/voice-worker/src/music/*.test.ts`                     |
| `tests/unit/test_spotify_integration.py`          | `apps/voice-worker/src/music/spotify.test.ts`               |
| `tests/unit/test_voice_commands.py`               | `apps/voice-worker/src/wakeword.test.ts` + `stt/*.test.ts`  |
| `tests/unit/test_web_search_service.py`           | `apps/bot/search/tavily.test.ts`                            |

## What each layer asserts

### Tools (unit)

- Each tool's `inputSchema` accepts/rejects expected inputs (`zod` parse).
- `execute` translates worker RPC errors into `{ ok: false, error }`.
- The tools registry `policy.ts` correctly hides unauthorized tools.

### Chat handlers (integration)

- `onNewMention` runs `generateText` with the right system prompt + tools.
- Memory retrieval is called once per turn and results are interpolated into the prompt.
- n8n fan-out fires after success and is skipped on failure.
- Stop condition: `stepCountIs(10)`.

### REST API (integration)

- Mirror Tangerina's Flask integration tests:
  - `/api/health` shape includes `bot_ready`.
  - 400 on invalid JSON / bad body for music, voice, TTS, chat.
  - 405 on wrong method.
  - 415 on missing `content-type: application/json`.
- 401 on missing `Authorization`.

### Memory (integration, Postgres container)

- Insert + retrieve produce the same string back.
- Cosine similarity ordering matches expectation on a known fixture set.
- Threshold filter drops items below threshold.
- Retention prune removes old rows.
- `forget` deletes by user/guild correctly.

### Voice worker (unit + integration)

- Music queue: enqueue/skip/clear/peek correctness.
- Spotify resolver returns `name + artist` string.
- Wake-word matcher: positive on `tangerina`, `Tangerina`, `tan­gerina` (with combining accent), negative on `tang`.
- TTS provider router calls the right backend per `TTS_PROVIDER`.
- STT provider router calls the right backend per `WHISPER_PROVIDER`.
- Volume ducking restores prior volume after listen window.

### Persona (unit)

- Snapshot test of the rendered persona prompt for a fixed `(recent, semantic, locale, toolList)` input.

## CI

`.github/workflows/test.yml`:

- Job `bot` — Node 22, pnpm install, `pnpm --filter bot test`, `pnpm --filter bot lint`, type-check.
- Job `worker` — Node 22, runs `pnpm --filter voice-worker test`. Uses ffmpeg from `setup-ffmpeg` action.
- Job `e2e` — boots Postgres + Redis services, runs `pnpm test:e2e` and `pnpm test:smoke`.

CI fails on any flaky-sensitive: `vitest --reporter=verbose --bail=1` for the worker suite, `--retry=2` for SSE tests.

## Smoke harness

`scripts/smoke.ts` — single command, no Discord. Spins up the bot in-process, posts a fake mention through the Chat SDK test transport, asserts:

1. Persona is loaded.
2. Tool registry has all 16 tools.
3. Mention triggers `generateText` once.
4. n8n webhook receives one POST.
5. `/api/health` returns 200.

The smoke script is what the user runs locally to verify everything wires up before hitting Discord.
