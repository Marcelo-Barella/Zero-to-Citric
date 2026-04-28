# 05 — Voice, Music, TTS

This subsystem stays Discord-only. It runs in the **voice worker** (a long-running Node process) because Vercel serverless cannot keep the voice gateway open. The Chat SDK bot on Vercel is the only caller.

## Worker stack

| Concern             | Choice                                                                  |
| ------------------- | ----------------------------------------------------------------------- |
| Discord client      | `discord.js` + `@discordjs/voice`                                       |
| Audio resources     | `@discordjs/opus`, `prism-media` for ffmpeg piping                      |
| YouTube source      | `yt-dlp` binary via `child_process` (mirrors Tangerina)                 |
| Spotify resolver    | `spotify-web-api-node` (resolves URI → track name → YouTube fallback)   |
| TTS — ElevenLabs    | `elevenlabs` Node SDK                                                   |
| TTS — Piper         | Reuse Tangerina's `deploy/piper` Docker image, called over HTTP         |
| STT — OpenAI Whisper| `openai` SDK `audio.transcriptions.create`                              |
| STT — Zhipu ASR     | `zhipu` REST client wrapper in `apps/voice-worker/src/stt/zhipu.ts`     |
| STT — sidecar       | Reuse Tangerina's `deploy/whisper` Docker image                         |
| RPC                 | Fastify with `@fastify/sse-v2`                                          |
| Auth                | Shared secret header `x-worker-secret`                                  |

## Worker architecture

```
discord.js client (one process per fleet instance)
├── voice connection registry            map<guildId, VoiceConnection>
├── queue manager                        map<guildId, Queue>
│     ├── current track + audio resource
│     ├── volume (0..1, default 0.5)
│     └── pending tracks
├── tts pipeline                         provider router (elevenlabs | piper)
├── stt pipeline                         provider router (openai | zhipu | sidecar)
├── wake-word listener                   silence-aware capture + detector
└── rpc server (fastify)                 routes mirroring Tangerina REST + SSE
```

## RPC surface (consumed by `apps/bot`)

| Method | Path                       | Body                                                                | Returns                                  |
| ------ | -------------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| GET    | `/worker/health`           | —                                                                   | `{ ready, version, voiceConnections }`   |
| GET    | `/worker/voice-channel`    | `?guildId&userId`                                                   | `{ channelId, channelName } \| null`     |
| POST   | `/worker/voice/join`       | `{ guildId, channelId }`                                            | `{ joined: true }`                       |
| POST   | `/worker/voice/leave`      | `{ guildId }`                                                       | `{ left: true }`                         |
| POST   | `/worker/music/play`       | `{ guildId, channelId, query, source?: 'youtube' \| 'spotify' }`    | `{ track, queuePosition }`               |
| POST   | `/worker/music/stop`       | `{ guildId }`                                                       | `{ stopped: true }`                      |
| POST   | `/worker/music/skip`       | `{ guildId }`                                                       | `{ skipped: true, next? }`               |
| POST   | `/worker/music/pause`      | `{ guildId }`                                                       | `{ paused: true }`                       |
| POST   | `/worker/music/resume`     | `{ guildId }`                                                       | `{ resumed: true }`                      |
| POST   | `/worker/music/volume`     | `{ guildId, volume: 0..100 }`                                       | `{ volume }`                             |
| GET    | `/worker/music/queue`      | `?guildId&limit&offset&info_level&include_current`                  | `{ current, items, total }`              |
| POST   | `/worker/tts/speak`        | `{ guildId, channelId, text, provider?: 'elevenlabs' \| 'piper' }`  | `{ played: true, durationMs }`           |
| POST   | `/worker/listen/start`     | `{ guildId, channelId, userId }`                                    | `{ listening: true, windowMs }`          |
| POST   | `/worker/listen/stop`      | `{ guildId, channelId, userId }`                                    | `{ listening: false }`                   |
| GET    | `/worker/events`           | SSE                                                                 | events: `transcript`, `track-ended`, `queue-empty`, `error` |

## Music pipeline

1. `MusicPlay` arrives with `query`. If `source === 'spotify'` resolve to `track name + artist` first.
2. `yt-dlp -j --no-playlist <query>` returns JSON metadata. Pick `formats` with audio only, prefer `m4a` 128kbps.
3. Spawn `yt-dlp -o - <url> | ffmpeg -i pipe:0 -f s16le -ar 48000 -ac 2 pipe:1`.
4. Wrap stdout in a `prism-media` Opus encoder, hand to `createAudioResource` with `inlineVolume: true`.
5. Push to per-guild queue. If nothing playing, immediately `audioPlayer.play(resource)`.
6. On `AudioPlayerStatus.Idle`, emit SSE `track-ended`, advance queue, or emit `queue-empty`.

Volume control sets `resource.volume!.setVolume(value/100)`.

## Spotify integration

```ts
// apps/voice-worker/src/music/spotify.ts
import SpotifyWebApi from 'spotify-web-api-node';

const sp = new SpotifyWebApi({
  clientId: env.SPOTIFY_CLIENT_ID,
  clientSecret: env.SPOTIFY_CLIENT_SECRET,
});

async function ensureToken() {
  if (sp.getAccessToken()) return;
  const t = await sp.clientCredentialsGrant();
  sp.setAccessToken(t.body.access_token);
}

export async function resolveSpotifyUri(uri: string) {
  await ensureToken();
  const id = uri.split(':').pop()!;
  const track = await sp.getTrack(id);
  const name = track.body.name;
  const artist = track.body.artists[0]?.name ?? '';
  return `${name} ${artist}`.trim();
}
```

The track is then played via the YouTube path. This matches Tangerina's behavior of using Spotify metadata + falling back to streamable audio.

## TTS pipeline

Provider router:

```ts
// apps/voice-worker/src/tts/index.ts
export async function speak(text: string, opts: { guildId: string; channelId: string; provider?: 'elevenlabs' | 'piper' }) {
  const provider = opts.provider ?? env.TTS_PROVIDER ?? 'elevenlabs';
  const audio = provider === 'piper'
    ? await piper.synthesize(text)
    : await elevenlabs.synthesize(text, env.ELEVEN_VOICE_ID ?? 'rachel');
  return playAudioStream(opts.guildId, opts.channelId, audio);
}
```

`playAudioStream` ducks any active music to 20% (mirrors Tangerina's listen-mode behavior), plays the TTS, restores volume.

## STT pipeline (wake-word path)

1. `bot.onSubscribedMessage` is not enough for voice — STT triggers come from the worker only.
2. Worker captures opus from `connection.receiver` per user, decodes to PCM, buffers 300ms windows.
3. Wake-word detector (`apps/voice-worker/src/wakeword.ts`) matches `tangerina` against rolling transcript chunks (or use a lightweight keyword model — `node-vad` for endpointing first).
4. On detection: emit SSE `wake`, duck music to 20%, open a 5s capture window.
5. Transcribe captured PCM with provider per `WHISPER_PROVIDER`:
   - `openai` — POST WAV to OpenAI `audio.transcriptions.create` (`whisper-1`).
   - `zhipu` — POST to Zhipu ASR (`GLM-ASR-2512`).
   - `sidecar` — POST to local `deploy/whisper` HTTP service.
6. SSE `transcript { guildId, channelId, userId, text }` — bot picks it up and runs the full chat handler with that text as the user message.

## Wake-word config

| Env                                | Default       | Notes                                       |
| ---------------------------------- | ------------- | ------------------------------------------- |
| `WAKE_WORD`                        | `tangerina`   | Lowercased, accent-stripped substring match |
| `WAKE_WINDOW_MS`                   | `5000`        | Listen window length                        |
| `WAKE_DUCK_VOLUME`                 | `20`          | Music volume during listen                  |
| `WHISPER_PROVIDER`                 | `zhipu`       | `.env.example` value                        |
| `WHISPER_SIDECAR_URL`              | `http://whisper:9000` | When `WHISPER_PROVIDER=sidecar`     |
| `PIPER_SIDECAR_URL`                | `http://piper:9001`   | TTS sidecar                          |
| `TTS_PROVIDER`                     | `elevenlabs`  |                                             |

## Reliability

- **Reconnect on voice gateway disconnect** — `discord.js/voice` `entersState(connection, VoiceConnectionStatus.Ready, 5_000)` + 1 retry.
- **Auto-leave when alone** — if channel members <= 1 (only the bot) for >120s, leave.
- **Per-guild queue caps** — max 50 items, configurable `MAX_QUEUE_SIZE`.
- **Graceful shutdown** — `SIGTERM` flushes queues, leaves voice channels, then exits.

## Rejected alternatives

- **Run voice on Vercel.** Rejected: 60s function timeout, no persistent WebSocket.
- **Move voice into the Chat SDK adapter.** Rejected: SDK is text-event-shaped (`onNewMention`, `onSubscribedMessage`, `onReaction`); voice is not a first-class concept yet. Revisit if/when an official voice adapter ships.
- **Use a remote Whisper API only (no sidecar).** Rejected: Tangerina supports `sidecar` for offline/private setups. Keep parity.
