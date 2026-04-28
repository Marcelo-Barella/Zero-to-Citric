# Zero To Citric — Tangerina on Vercel Chat SDK

## Context

This project is a submission for **Vercel "Zero To Agent"** hackathon, **Track 3: ChatSDK Agents** (per [vercel.notion.site/02agentresources](https://vercel.notion.site/02agentresources)).

> Track 3 brief (verbatim from the resources hub): *"Build agents using Vercel AI SDK + AI Gateway + ChatSDK that interface across Slack, Discord, Teams, GitHub, and more. Write your bot logic once with the Chat SDK (`npm i chat`), then deploy to every platform via swappable adapters. The SDK handles event routing, streaming, JSX cards, and distributed state."*

## Source Project — Tangerina (current state)

[`Marcelo-Barella/Tangerina`](https://github.com/Marcelo-Barella/Tangerina) is today a Python Discord bot:

- `discord.py[voice] >=2.3.0` + `Flask >=3.0.0` (REST control plane on `:5000`)
- Multi-provider LLM router (`MODEL_PROVIDER`: `zhipu` | `openai` | `gemini`) with 16 function-calling tools
- Optional `ChromaDB` long-term memory with sentence-transformers / OpenAI embeddings
- Music (YouTube via `yt-dlp`, Spotify via `spotipy`)
- Voice STT (Zhipu ASR / OpenAI Whisper / sidecar Piper-Whisper) + TTS (ElevenLabs / Piper)
- Wake word `tangerina`, listening mode with volume ducking
- Tavily web search, n8n webhook hand-off
- Brazilian Portuguese persona (`chatbot/tangerina_persona.txt`)

## Target Project — Tangerina on Chat SDK

Re-implement Tangerina as a **TypeScript / Node** project built on the **Vercel Chat SDK** (`npm i chat`) so the same bot logic runs across Discord first, with the door open to Slack / Teams / GitHub / Linear / WhatsApp via adapters. Music + voice STT/TTS (Discord-only capabilities) stay behind a Discord-specific extension layer.

## Track 3 Pattern (from the hub)

```bash
npm install chat @chat-adapter/discord @chat-adapter/state-redis
```

```ts
import { Chat } from 'chat';
import { discord } from '@chat-adapter/discord';
import { redis } from '@chat-adapter/state-redis';

const bot = new Chat({
  adapters: [discord()],
  state: redis(),
});

bot.onNewMention(async ({ thread, message }) => { /* ... */ });
bot.onSubscribedMessage(async ({ thread, message }) => { /* ... */ });
bot.onReaction(async ({ thread, reaction }) => { /* ... */ });
```

LLM calls go through the **Vercel AI SDK** + **AI Gateway** so the same code can pick `anthropic/claude-sonnet-4-6`, `openai/gpt-5`, `google/gemini-2.5-pro`, etc. without provider-specific clients.

## Why this re-platforming matters

| Current (Python)                              | Target (Chat SDK)                                       |
| --------------------------------------------- | ------------------------------------------------------- |
| `discord.py` event loop                       | `@chat-adapter/discord` event routing                   |
| Three custom provider clients (Zhipu/OAI/Gem) | Single `ai` SDK call via AI Gateway                     |
| Hand-rolled tool schema in JSON               | `tool({ inputSchema, execute })` from `ai`              |
| Flask REST control plane                      | Next.js route handlers (or Vercel functions)            |
| ChromaDB on disk                              | `@vercel/postgres` + `pgvector`, or upstash-vector      |
| Threading + asyncio bridge                    | Native Node async + Chat SDK distributed state          |
| `.env` only                                   | Vercel env + AI Gateway key + adapter credentials       |

## Spec Set Index

| File                                     | Scope                                                                |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `00-overview.md`                         | This file                                                            |
| `01-architecture.md`                     | Runtime topology, packages, deployment surfaces                      |
| `02-feature-parity-matrix.md`            | One row per Tangerina capability with target implementation          |
| `03-tools.md`                            | Each function-calling tool: schema, handler, adapter coupling        |
| `04-memory-and-rag.md`                   | Replacement for ChromaDB long-term memory                            |
| `05-voice-music-tts.md`                  | Discord-only voice subsystem, music, STT, TTS, wake word             |
| `06-rest-api.md`                         | Flask → Next.js route handlers mapping                               |
| `07-persona-and-language.md`             | Persona file, locale, response policy                                |
| `08-deployment-and-env.md`               | Vercel deployment + env var inventory                                |
| `09-testing.md`                          | Vitest + Playwright + smoke harness                                  |
| `10-milestones.md`                       | Build order so the bot says hello on Discord by milestone 1          |

## Hard Constraints

1. **Chat SDK first.** All cross-platform-shaped logic lives behind `chat` adapters. Discord-only features are isolated extensions.
2. **AI Gateway only.** No provider-specific SDKs in tool/handler code. Default model: `anthropic/claude-sonnet-4-6` (per hub example), overridable by env.
3. **TypeScript.** No Python. No Flask.
4. **Feature parity ≥ Tangerina v0.** The 16 tools, the wake word, the music pipeline, the persona, the n8n webhook — all preserved.
5. **Deployable to Vercel.** Long-running voice / STT / TTS that does not fit serverless gets a documented "voice worker" deployment target.
