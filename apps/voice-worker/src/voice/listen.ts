import { EndBehaviorType } from '@discordjs/voice';
import prism from 'prism-media';
import { connections } from './connection-registry.js';
import { eventBus } from '../rpc/event-bus.js';
import { loadEnv } from '../env.js';
import { matchesWakeWord } from '../wakeword.js';
import { ok, err, type Result } from '../result.js';

export interface ListenSession {
  stop: () => void;
}

export async function startUserListenSession(input: { guildId: string; channelId: string; userId: string }): Promise<Result<ListenSession>> {
  const env = loadEnv();
  const conn = connections.get(input.guildId);
  if (!conn) return err('not_in_voice');
  const receiver = conn.receiver;

  let stopped = false;
  const stop = (): void => {
    stopped = true;
  };

  const subscription = receiver.subscribe(input.userId, {
    end: { behavior: EndBehaviorType.AfterSilence, duration: 700 },
  });

  const opus = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
  const chunks: Buffer[] = [];
  subscription.pipe(opus).on('data', (c: Buffer) => chunks.push(c));
  subscription.once('end', async () => {
    if (stopped) return;
    const pcm = Buffer.concat(chunks);
    const { transcribe } = await import('../stt/index.js');
    const r = await transcribe(pcm);
    if (!r.ok) return;
    if (matchesWakeWord(r.data, env.WAKE_WORD)) {
      eventBus.emitEvent('wake', { ...input });
      // Capture follow-up window - omitted in this baseline, full handler chain runs from bot side
    }
    eventBus.emitEvent('transcript', { ...input, text: r.data });
  });

  return ok({ stop });
}
