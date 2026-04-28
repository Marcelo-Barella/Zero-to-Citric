# 02 — Feature Parity Matrix

Every row is a capability that exists in current Tangerina (`Marcelo-Barella/Tangerina@main`). The "Target" column is how we re-implement it on Chat SDK + Vercel. "Status" is the milestone in `10-milestones.md` that owns delivery.

## Bot lifecycle

| Tangerina capability                                         | Source ref                          | Target implementation                                                | Milestone |
| ------------------------------------------------------------ | ----------------------------------- | -------------------------------------------------------------------- | --------- |
| Boot Discord client with intents (message content + voice)   | `app.py`                            | `@chat-adapter/discord` configured with same intents in `chat/bot.ts`| M1        |
| Run Flask in daemon thread alongside Discord loop            | `app.py`                            | Next.js route handlers (no separate process needed)                  | M1        |
| `bot_ready` flag gating all REST handlers                    | `flask_routes.require_bot_ready`    | `chat` SDK exposes a ready promise; `/api/*` middleware awaits it    | M1        |
| Graceful shutdown (`SIGINT/SIGTERM`)                         | `app.py`                            | Vercel manages serverless lifetime; voice worker handles SIGTERM     | M1        |

## Conversation triggers

| Tangerina capability                                         | Source ref                                  | Target implementation                                          | Milestone |
| ------------------------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------- | --------- |
| Respond on substring `tangerina`                             | `should_respond_with_chatbot` in `app.py`   | `bot.onSubscribedMessage` matcher + `bot.onNewMention`         | M1        |
| Respond when bot mentioned                                   | same                                        | `bot.onNewMention`                                             | M1        |
| Respond in DMs (`guild is None`)                             | same                                        | adapter detects DM channel; routed through same handler        | M1        |
| Respond to reactions (none today, free upgrade)              | —                                           | `bot.onReaction` reserved, off by default                      | M3        |

## LLM orchestration

| Tangerina capability                                         | Source ref                                                | Target implementation                                                                  | Milestone |
| ------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------- |
| `MODEL_PROVIDER` switch (zhipu / openai / gemini)            | `chatbot/model_helper.py`, `chatbot/*_integration.py`     | Single `ai` SDK call against AI Gateway. `LLM_MODEL` env names the gateway model id    | M1        |
| Function-calling loop with `max_iterations = 10`             | `generate_response_with_tools`                            | `streamText({ tools, stopWhen: stepCountIs(10) })` from `ai` SDK                        | M2        |
| Persona prompt prepended every turn                          | `BaseChatbot._build_messages`                              | `system` message from `apps/bot/ai/prompts/persona.ts`                                 | M1        |
| Recent + semantic memory retrieval injected into prompt      | `MemoryManager.retrieve_context`                          | `apps/bot/memory/retrieve.ts` returns `{ recent, semantic }`, formatter inlines        | M3        |
| Malformed tool-call recovery                                 | `model_helper` fallback path                              | `ai` SDK already handles invalid JSON args; add explicit error tool result + retry hint | M2        |

## Tools (function calls)

See `03-tools.md` for full detail. Every tool listed there ships at the milestone noted there.

## Memory

See `04-memory-and-rag.md`.

| Tangerina capability                                         | Source ref                  | Target implementation                                                | Milestone |
| ------------------------------------------------------------ | --------------------------- | -------------------------------------------------------------------- | --------- |
| ChromaDB collection `tangerina_memory`                        | `chatbot/memory_manager.py` | Postgres table `memories` with `pgvector` HNSW index                 | M3        |
| Embeddings via `sentence-transformers` or OpenAI             | `chatbot/embedding_service.py` | `ai` SDK `embed()` against AI Gateway embedding model               | M3        |
| Recent-interactions deque per `guild_channel_user`           | `MemoryManager`             | Redis sorted set keyed `recent:{guildId}:{channelId}:{userId}`       | M3        |
| Cleanup / retention (default 30 days)                        | `MEMORY_RETENTION_DAYS`     | nightly Vercel cron `/api/cron/memory-prune`                         | M3        |
| Delete-by-user / delete-by-guild                             | `MemoryManager`             | admin-only API routes `/api/memory/forget`                           | M3        |

## Voice / Music / TTS

See `05-voice-music-tts.md`. All of this lives in the voice worker.

| Tangerina capability                                         | Source ref                          | Target implementation                                              | Milestone |
| ------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------ | --------- |
| YouTube playback via `yt-dlp`                                | `features/music/music_service.py`   | `yt-dlp` binary in voice worker; `discord.js/voice` for playback   | M2        |
| Spotify URI playback (resolve → play)                        | `features/music/spotify_integration.py` | `spotify-web-api-node` resolves to track name → YouTube fallback   | M2        |
| Queue (peek / skip / pause / resume / volume 0–100)          | `flask_routes` `/music/*`           | Worker keeps in-memory queue per guild; bot calls RPC              | M2        |
| ElevenLabs TTS                                               | `features/tts/tts_handler.py`        | ElevenLabs Node SDK in worker; HTTP shim from bot                  | M3        |
| Piper TTS sidecar                                            | `deploy/piper/server.py`             | Same Piper container, exposed inside voice worker network          | M3        |
| Voice STT — Zhipu ASR                                        | `features/voice/voice_commands.py`  | Provider plugin in `apps/voice-worker/src/stt/zhipu.ts`            | M3        |
| Voice STT — OpenAI Whisper                                   | same                                | `apps/voice-worker/src/stt/openai.ts`                              | M3        |
| Voice STT — sidecar (Piper-Whisper)                          | `deploy/whisper/server.py`           | Reuse container, RPC from worker                                   | M3        |
| Wake word `tangerina` with 5s listen window                  | `voice_commands.py`                 | `wakeword.ts`, configurable threshold and window                   | M3        |
| Music volume ducking to 20% during listen                    | same                                | Worker applies gain envelope to active track                       | M3        |

## Web search

| Tangerina capability                                         | Source ref                          | Target implementation                                                  | Milestone |
| ------------------------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------- | --------- |
| `WebSearch` tool via Tavily                                  | `chatbot/web_search_service.py`     | `apps/bot/search/tavily.ts` + `ai.tool({ name: 'webSearch', … })`      | M2        |
| Toggle via `WEB_SEARCH_ENABLED` (auto-enable if key set)     | `app.py` `WEB_SEARCH_ENABLED`       | Same env, same default                                                 | M2        |

## Integrations

| Tangerina capability                                         | Source ref                          | Target implementation                                                  | Milestone |
| ------------------------------------------------------------ | ----------------------------------- | ---------------------------------------------------------------------- | --------- |
| n8n webhook hand-off with enriched JSON                      | `app.py` `extract_message_data`     | `apps/bot/webhooks/n8n.ts`, fired after each handler completes         | M2        |
| Attachment metadata forwarded to n8n                         | same                                | Adapter exposes Discord attachments; same shape JSON                   | M2        |

## REST API

See `06-rest-api.md`. All 16 Flask routes get a Next.js route handler counterpart. `/chatbot/message` (stateless chat) is preserved as `/api/chat`.

## Persona / locale

See `07-persona-and-language.md`.

| Tangerina capability                                         | Source ref                  | Target implementation                                  | Milestone |
| ------------------------------------------------------------ | --------------------------- | ------------------------------------------------------ | --------- |
| Brazilian Portuguese persona file                            | `chatbot/tangerina_persona.txt` | `packages/persona/tangerina_persona.md`               | M1        |
| `LOG_LEVEL` env                                              | `.env.example`              | `LOG_LEVEL` env consumed by `pino`                     | M1        |
