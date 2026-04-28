import type { RpcMusicPlay, Track } from '@zero-to-citric/shared-types';
import { ok, err, type Result } from '../result.js';
import { queueManager } from './queue.js';

/**
 * Plays a track or enqueues if music is already playing.
 * Real audio streaming is delegated to ./youtube.ts and ./spotify.ts.
 */
export async function playMusic(req: RpcMusicPlay): Promise<Result<{ track: Track; queuePosition: number }>> {
  let track: Track;
  if (req.source === 'spotify') {
    const { resolveSpotifyTrack } = await import('./spotify.js');
    const r = await resolveSpotifyTrack(req.query);
    if (!r.ok) return err(r.error);
    track = r.data;
  } else {
    const { resolveYoutubeTrack } = await import('./youtube.js');
    const r = await resolveYoutubeTrack(req.query);
    if (!r.ok) return err(r.error);
    track = r.data;
  }

  try {
    const { position } = queueManager.enqueue(req.guildId, req.channelId, track);
    const q = queueManager.ensure(req.guildId, req.channelId);
    if (!q.current) {
      // Pop and start. Audio streaming wiring with discord.js voice happens in startStream.
      const next = queueManager.shift(req.guildId);
      if (next) {
        queueManager.setCurrent(req.guildId, next);
        const { startStream } = await import('./youtube.js');
        await startStream(req.guildId, req.channelId, next).catch(() => undefined);
      }
    }
    return ok({ track, queuePosition: position });
  } catch (e) {
    return err((e as Error).message ?? 'enqueue_failed');
  }
}
