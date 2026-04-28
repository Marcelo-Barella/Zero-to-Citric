import { spawn } from 'node:child_process';
import { createAudioPlayer, createAudioResource, StreamType } from '@discordjs/voice';
import type { Track } from '@zero-to-citric/shared-types';
import { connections } from '../voice/connection-registry.js';
import { queueManager } from './queue.js';
import { eventBus } from '../rpc/event-bus.js';
import { logger } from '../logger.js';
import { ok, err, type Result } from '../result.js';

interface YtdlpJson {
  title?: string;
  webpage_url?: string;
  duration?: number;
}

export async function resolveYoutubeTrack(query: string): Promise<Result<Track>> {
  return new Promise<Result<Track>>((resolve) => {
    const args = ['-j', '--no-playlist', '--default-search', 'ytsearch1', query];
    const proc = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c: Buffer) => (stdout += c.toString()));
    proc.stderr.on('data', (c: Buffer) => (stderr += c.toString()));
    proc.on('error', (e) => resolve(err((e as Error).message)));
    proc.on('close', (code) => {
      if (code !== 0) {
        logger().warn({ code, stderr: stderr.slice(0, 500) }, 'yt-dlp metadata failed');
        return resolve(err('youtube_resolve_failed'));
      }
      try {
        const meta = JSON.parse(stdout.split('\n')[0] ?? '{}') as YtdlpJson;
        if (!meta.title || !meta.webpage_url) return resolve(err('youtube_resolve_empty'));
        return resolve(
          ok({ title: meta.title, url: meta.webpage_url, duration: meta.duration, source: 'youtube' as const }),
        );
      } catch (e) {
        return resolve(err((e as Error).message));
      }
    });
  });
}

export async function startStream(guildId: string, _channelId: string, track: Track): Promise<void> {
  const conn = connections.get(guildId);
  if (!conn) throw new Error('not_connected');
  if (!track.url) throw new Error('no_url');

  const ytdlp = spawn('yt-dlp', ['-o', '-', '-f', 'bestaudio', '--quiet', track.url]);
  const ffmpeg = spawn('ffmpeg', [
    '-i', 'pipe:0',
    '-analyzeduration', '0',
    '-loglevel', 'error',
    '-f', 's16le',
    '-ar', '48000',
    '-ac', '2',
    'pipe:1',
  ]);
  ytdlp.stdout.pipe(ffmpeg.stdin);

  const resource = createAudioResource(ffmpeg.stdout, { inputType: StreamType.Raw, inlineVolume: true });
  const queue = queueManager.ensure(guildId);
  resource.volume?.setVolume(queue.volume / 100);

  const player = queue.player ?? createAudioPlayer();
  queue.player = player;
  conn.subscribe(player);
  player.play(resource);

  player.on('error', (err) => logger().error({ err }, 'audio player error'));
  player.once('idle', () => {
    eventBus.emitEvent('track-ended', { guildId, track });
    const next = queueManager.shift(guildId);
    if (next) {
      queueManager.setCurrent(guildId, next);
      void startStream(guildId, _channelId, next).catch(() => undefined);
    } else {
      queueManager.setCurrent(guildId, null);
      eventBus.emitEvent('queue-empty', { guildId });
    }
  });
}
