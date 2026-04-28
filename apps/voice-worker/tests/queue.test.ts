import { describe, expect, it, beforeEach } from 'vitest';
import { queueManager } from '../src/music/queue.js';
import { resetEnvCache } from '../src/env.js';

beforeEach(() => {
  process.env.MAX_QUEUE_SIZE = '5';
  resetEnvCache();
  for (const id of queueManager.list()) queueManager.clear(id);
});

describe('queueManager', () => {
  it('enqueues tracks and reports position', () => {
    const a = queueManager.enqueue('g', 'c', { title: 'A' });
    const b = queueManager.enqueue('g', 'c', { title: 'B' });
    expect(a.position).toBe(1);
    expect(b.position).toBe(2);
  });

  it('snapshot returns paged items', () => {
    queueManager.enqueue('g', 'c', { title: 'A' });
    queueManager.enqueue('g', 'c', { title: 'B' });
    queueManager.enqueue('g', 'c', { title: 'C' });
    const snap = queueManager.snapshot({ guildId: 'g', limit: 2, offset: 1, info_level: 'compact', include_current: true });
    expect(snap.total).toBe(3);
    expect(snap.items.length).toBe(2);
    expect(snap.items[0]!.track.title).toBe('B');
  });

  it('skip returns the head of the pending queue', () => {
    queueManager.setCurrent('g', { title: 'A' });
    queueManager.enqueue('g', 'c', { title: 'B' });
    const next = queueManager.skip('g');
    expect(next?.title).toBe('B');
  });

  it('skip returns null when queue is empty', () => {
    queueManager.setCurrent('g', { title: 'A' });
    expect(queueManager.skip('g')).toBe(null);
  });

  it('setVolume clamps to 0..100', () => {
    queueManager.setVolume('g', -10);
    expect(queueManager.ensure('g').volume).toBe(0);
    queueManager.setVolume('g', 200);
    expect(queueManager.ensure('g').volume).toBe(100);
  });

  it('respects MAX_QUEUE_SIZE', () => {
    for (let i = 0; i < 5; i++) queueManager.enqueue('g', 'c', { title: `T${i}` });
    expect(() => queueManager.enqueue('g', 'c', { title: 'overflow' })).toThrow(/queue_full/);
  });
});
