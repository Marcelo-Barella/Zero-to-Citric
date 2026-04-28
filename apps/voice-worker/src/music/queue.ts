import type { AudioPlayer } from '@discordjs/voice';
import type { Track, QueueItem, RpcQueueQuery } from '@zero-to-citric/shared-types';
import { loadEnv } from '../env.js';

export interface GuildQueue {
  guildId: string;
  channelId: string;
  current: Track | null;
  pending: Track[];
  volume: number; // 0..100
  paused: boolean;
  player?: AudioPlayer;
}

const queues = new Map<string, GuildQueue>();

function ensure(guildId: string, channelId?: string): GuildQueue {
  let q = queues.get(guildId);
  if (!q) {
    q = { guildId, channelId: channelId ?? '', current: null, pending: [], volume: 50, paused: false };
    queues.set(guildId, q);
  } else if (channelId) {
    q.channelId = channelId;
  }
  return q;
}

function snapshotItems(q: GuildQueue, opts: RpcQueueQuery): QueueItem[] {
  const start = opts.offset;
  const end = start + opts.limit;
  return q.pending.slice(start, end).map((t, i) => ({ position: start + i, track: t }));
}

export const queueManager = {
  get(guildId: string): GuildQueue | undefined {
    return queues.get(guildId);
  },
  ensure,
  enqueue(guildId: string, channelId: string, track: Track): { position: number } {
    const env = loadEnv();
    const q = ensure(guildId, channelId);
    if (q.pending.length + (q.current ? 1 : 0) >= env.MAX_QUEUE_SIZE) {
      throw new Error('queue_full');
    }
    q.pending.push(track);
    return { position: q.pending.length };
  },
  setCurrent(guildId: string, track: Track | null): void {
    const q = ensure(guildId);
    q.current = track;
  },
  shift(guildId: string): Track | undefined {
    const q = ensure(guildId);
    return q.pending.shift();
  },
  stop(guildId: string): void {
    const q = queues.get(guildId);
    if (!q) return;
    q.pending = [];
    q.current = null;
    q.player?.stop(true);
  },
  skip(guildId: string): Track | null {
    const q = queues.get(guildId);
    if (!q) return null;
    q.player?.stop();
    return q.pending[0] ?? null;
  },
  pause(guildId: string): void {
    const q = queues.get(guildId);
    if (!q) return;
    q.paused = true;
    q.player?.pause();
  },
  resume(guildId: string): void {
    const q = queues.get(guildId);
    if (!q) return;
    q.paused = false;
    q.player?.unpause();
  },
  setVolume(guildId: string, volume: number): void {
    const q = ensure(guildId);
    q.volume = Math.max(0, Math.min(100, Math.floor(volume)));
  },
  snapshot(opts: RpcQueueQuery): { current: QueueItem | null; items: QueueItem[]; total: number } {
    const q = queues.get(opts.guildId);
    if (!q) return { current: null, items: [], total: 0 };
    const current: QueueItem | null = q.current ? { position: -1, track: q.current } : null;
    return {
      current: opts.include_current ? current : null,
      items: snapshotItems(q, opts),
      total: q.pending.length,
    };
  },
  clear(guildId: string): void {
    queues.delete(guildId);
  },
  list(): string[] {
    return Array.from(queues.keys());
  },
};
