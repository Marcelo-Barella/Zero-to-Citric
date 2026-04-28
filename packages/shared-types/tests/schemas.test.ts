import { describe, expect, it } from 'vitest';
import { rpcMusicPlaySchema, rpcMusicVolumeSchema, rpcQueueQuerySchema } from '../src/index.js';

describe('shared-types schemas', () => {
  it('accepts a valid music play payload', () => {
    const r = rpcMusicPlaySchema.safeParse({ guildId: 'g1', channelId: 'c1', query: 'tropicalia' });
    expect(r.success).toBe(true);
  });

  it('rejects empty query', () => {
    const r = rpcMusicPlaySchema.safeParse({ guildId: 'g1', channelId: 'c1', query: '' });
    expect(r.success).toBe(false);
  });

  it('caps queue limit at 25', () => {
    const r = rpcQueueQuerySchema.safeParse({ guildId: 'g1', limit: 30 });
    expect(r.success).toBe(false);
  });

  it('rejects volume > 100', () => {
    const r = rpcMusicVolumeSchema.safeParse({ guildId: 'g1', volume: 150 });
    expect(r.success).toBe(false);
  });

  it('accepts edge volume 0 and 100', () => {
    expect(rpcMusicVolumeSchema.safeParse({ guildId: 'g1', volume: 0 }).success).toBe(true);
    expect(rpcMusicVolumeSchema.safeParse({ guildId: 'g1', volume: 100 }).success).toBe(true);
  });
});
