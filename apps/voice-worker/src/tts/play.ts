import { Readable } from 'node:stream';
import { createAudioPlayer, createAudioResource, NoSubscriberBehavior } from '@discordjs/voice';
import { connections } from '../voice/connection-registry.js';
import { queueManager } from '../music/queue.js';
import { loadEnv } from '../env.js';
import { ok, err, type Result } from '../result.js';

export async function playTts(guildId: string, _channelId: string, buffer: Buffer): Promise<Result<{ durationMs: number }>> {
  const conn = connections.get(guildId);
  if (!conn) return err('not_in_voice');
  const env = loadEnv();
  const queue = queueManager.ensure(guildId);
  const previousVolume = queue.volume;

  const ttsPlayer = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Stop } });
  const resource = createAudioResource(Readable.from(buffer), { inlineVolume: true });
  resource.volume?.setVolume(1);

  // duck music
  if (queue.player && queue.current) {
    queueManager.setVolume(guildId, env.WAKE_DUCK_VOLUME);
  }

  conn.subscribe(ttsPlayer);
  ttsPlayer.play(resource);
  const start = Date.now();
  await new Promise<void>((resolve) => {
    ttsPlayer.once('idle', () => resolve());
    ttsPlayer.once('error', () => resolve());
  });

  // restore
  if (queue.player && queue.current) {
    queueManager.setVolume(guildId, previousVolume);
    if (queue.player) conn.subscribe(queue.player);
  }
  return ok({ durationMs: Date.now() - start });
}
