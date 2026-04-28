# 03 — Tools (Function Calls)

Every tool below mirrors a tool from Tangerina's `build_tools_schema()` in `chatbot/model_helper.py`. Names are kept identical so the persona prompt copies cleanly. Each tool is implemented with the `ai` SDK's `tool()` helper and registered on the LLM call inside `apps/bot/chat/handlers/onMention.ts`.

## Shared shape

```ts
import { tool } from 'ai';
import { z } from 'zod';

export const guildId = z.string().min(1).describe('Discord guild (server) id');
export const channelId = z.string().min(1).describe('Discord channel id');
export const userId = z.string().min(1).describe('Discord user id');

export const ToolError = z.object({ ok: z.literal(false), error: z.string() });
export const ToolOk = <T extends z.ZodTypeAny>(t: T) =>
  z.object({ ok: z.literal(true), data: t });
```

All handlers return `{ ok: true, data }` or `{ ok: false, error }`. The model is instructed (in the persona prompt) to interpret `ok=false` and continue.

## Tool catalogue

| # | Name                  | Inputs                                                                 | Output                                                  | Backed by                                  |
|---|-----------------------|------------------------------------------------------------------------|---------------------------------------------------------|--------------------------------------------|
| 1 | `GET_Canais`          | `guildId`                                                              | `Array<{ id, name, type }>`                             | `chat` SDK Discord adapter `guild.channels`|
| 2 | `GET_UserVoiceChannel`| `guildId`, `userId`                                                    | `{ channelId, channelName } \| null`                    | Voice worker `/worker/voice-channel`       |
| 3 | `SEND_Mensagem`       | `channelId`, `text`                                                    | `{ messageId }`                                         | Discord adapter `channel.send`             |
| 4 | `EnterChannel`        | `guildId`, `channelId`                                                 | `{ joined: true }`                                      | Voice worker `/worker/voice/join`          |
| 5 | `LeaveChannel`        | `guildId`                                                              | `{ left: true }`                                        | Voice worker `/worker/voice/leave`         |
| 6 | `MusicPlay`           | `guildId`, `channelId`, `query`                                        | `{ track, queuePosition }`                              | Voice worker `/worker/music/play`          |
| 7 | `MusicStop`           | `guildId`                                                              | `{ stopped: true }`                                     | Voice worker                               |
| 8 | `MusicSkip`           | `guildId`                                                              | `{ skipped: true, next? }`                              | Voice worker                               |
| 9 | `MusicPause`          | `guildId`                                                              | `{ paused: true }`                                      | Voice worker                               |
|10 | `MusicResume`         | `guildId`                                                              | `{ resumed: true }`                                     | Voice worker                               |
|11 | `MusicVolume`         | `guildId`, `volume` (0–100)                                            | `{ volume }`                                            | Voice worker (validates range)             |
|12 | `GET_MusicQueue`      | `guildId`, `limit?`, `offset?`, `info_level?`, `include_current?`      | `{ current, items, total }`                             | Voice worker                               |
|13 | `MusicSpotifyPlay`    | `guildId`, `channelId`, `spotifyUri`                                   | `{ track, queuePosition }`                              | Voice worker (spotify resolver)            |
|14 | `MusicLeave`          | `guildId`                                                              | `{ left: true }`                                        | Alias of `LeaveChannel`, kept for parity   |
|15 | `TTSSpeak`            | `guildId`, `channelId`, `text`                                         | `{ played: true, durationMs }`                          | Voice worker `/worker/tts/speak`           |
|16 | `WebSearch`           | `query`                                                                | `Array<{ title, url, snippet, score }>`                 | Tavily client in `apps/bot/search/tavily.ts`|

## Example: `MusicPlay`

```ts
// apps/bot/ai/tools/music-play.ts
import { tool } from 'ai';
import { z } from 'zod';
import { guildId, channelId, ToolOk, ToolError } from './_shared';
import { worker } from '@/lib/voice-worker-client';

export const MusicPlay = tool({
  description:
    'Toca uma música no canal de voz do servidor. Aceita link ou termo de busca.',
  inputSchema: z.object({
    guildId,
    channelId,
    query: z.string().min(1).max(300),
  }),
  execute: async ({ guildId, channelId, query }) => {
    const res = await worker.post('/worker/music/play', { guildId, channelId, query });
    if (!res.ok) return { ok: false as const, error: res.error };
    return { ok: true as const, data: res.data };
  },
});
```

## Example: `WebSearch`

```ts
// apps/bot/ai/tools/web-search.ts
import { tool } from 'ai';
import { z } from 'zod';
import { tavily } from '@/search/tavily';
import { env } from '@/lib/env';

export const WebSearch = tool({
  description: 'Busca na web informações atualizadas para responder o usuário.',
  inputSchema: z.object({ query: z.string().min(1).max(400) }),
  execute: async ({ query }) => {
    if (!env.TAVILY_API_KEY) return { ok: false as const, error: 'web_search_disabled' };
    const results = await tavily.search(query, { maxResults: 5 });
    return { ok: true as const, data: results };
  },
});
```

## Registration

```ts
// apps/bot/ai/tools/index.ts
import * as t from './all';

export const tools = {
  GET_Canais: t.GetCanais,
  GET_UserVoiceChannel: t.GetUserVoiceChannel,
  SEND_Mensagem: t.SendMensagem,
  EnterChannel: t.EnterChannel,
  LeaveChannel: t.LeaveChannel,
  MusicPlay: t.MusicPlay,
  MusicStop: t.MusicStop,
  MusicSkip: t.MusicSkip,
  MusicPause: t.MusicPause,
  MusicResume: t.MusicResume,
  MusicVolume: t.MusicVolume,
  GET_MusicQueue: t.GetMusicQueue,
  MusicSpotifyPlay: t.MusicSpotifyPlay,
  MusicLeave: t.MusicLeave,
  TTSSpeak: t.TTSSpeak,
  WebSearch: t.WebSearch,
} as const;

export type ToolName = keyof typeof tools;
```

```ts
// apps/bot/chat/handlers/onMention.ts
import { generateText, stepCountIs } from 'ai';
import { gateway } from '@/ai/gateway';
import { persona } from '@/ai/prompts/persona';
import { tools } from '@/ai/tools';

bot.onNewMention(async ({ thread, message, user, channel }) => {
  const ctx = await retrieveContext({ guildId: channel.guildId, channelId: channel.id, userId: user.id });

  const result = await generateText({
    model: gateway(env.LLM_MODEL),
    system: persona({ ctx, locale: env.BOT_LOCALE }),
    messages: [{ role: 'user', content: message.text }],
    tools,
    stopWhen: stepCountIs(10),
  });

  if (result.text) await thread.post(result.text);
  await fanOutToN8n({ message, response: result, toolCalls: result.toolCalls });
});
```

## Notes per tool

- **`SEND_Mensagem`**: in Tangerina the persona is told this is the "only way" to send a Discord message. Keep that wording — it prevents the model from echoing tool results as plain assistant text twice.
- **`GET_MusicQueue`**: Tangerina supports `info_level` (compact / full). Preserve, default `compact`. Cap `limit` at 25 to keep payload small.
- **`MusicLeave`** vs **`LeaveChannel`**: Tangerina keeps both. Keep both, mark `MusicLeave` as `deprecated: true` in the description.
- **`TTSSpeak`**: persona text mentions ElevenLabs but the worker resolves provider from `TTS_PROVIDER`. Tool description says provider-agnostic.
- **`WebSearch`**: gate behind `WEB_SEARCH_ENABLED` env. When disabled, the tool is not registered at all (model can't call it).

## Tool authorization

A small allow-list lives in `apps/bot/ai/tools/policy.ts`:

```ts
export function canUseTool(name: ToolName, ctx: { guildId: string; userId: string }): boolean {
  if (name.startsWith('Music') || name === 'TTSSpeak' || name === 'EnterChannel' || name === 'LeaveChannel')
    return env.FEATURE_VOICE === 'on';
  if (name === 'WebSearch') return Boolean(env.TAVILY_API_KEY);
  return true;
}
```

Tools that fail the allow-list are not registered for that turn, so the model never sees them.
