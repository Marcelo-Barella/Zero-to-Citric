import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { resetEnvCache, loadEnv } from '../../lib/env';

const HAVE_DOCKER = process.env.SKIP_TESTCONTAINERS !== '1' && process.env.CI_NO_DOCKER !== '1';

const describeIfDocker = HAVE_DOCKER ? describe : describe.skip;

describeIfDocker('memory (pgvector + redis stubbed)', () => {
  let pg: StartedPostgreSqlContainer | undefined;

  beforeAll(async () => {
    try {
      pg = await new PostgreSqlContainer('pgvector/pgvector:pg16').withStartupTimeout(120_000).start();
    } catch {
      // No docker available — skip suite
      pg = undefined;
    }
  }, 130_000);

  afterAll(async () => {
    if (pg) await pg.stop();
    const { closeDb } = await import('../../memory/db');
    await closeDb();
  });

  beforeEach(() => {
    if (!pg) return;
    resetEnvCache();
    process.env.MEMORY_ENABLED = 'true';
    process.env.POSTGRES_URL = pg.getConnectionUri();
    // The schema check requires KV vars even though the test does not use Redis directly.
    process.env.KV_REST_API_URL = 'https://kv.test.invalid';
    process.env.KV_REST_API_TOKEN = 'token';
  });

  it('initializes schema and inserts/reads memories', async () => {
    if (!pg) return; // skip if docker missing
    loadEnv();
    const { initSchema, insertMemory, semanticSearch, deleteByGuild, pruneOldMemories } = await import(
      '../../memory/db'
    );
    // Mock embed to avoid hitting the gateway in tests.
    vi.doMock('../../memory/embed', () => ({
      embedText: async (_text: string) => Array(1536).fill(0).map((_, i) => Math.sin(i / 50)),
    }));
    await initSchema();

    await insertMemory({
      guildId: 'g1',
      channelId: 'c1',
      userId: 'u1',
      messageType: 'chat',
      text: 'User: oi\nBot: olá',
      toolCalls: 0,
      embedding: Array(1536).fill(0).map((_, i) => Math.sin(i / 50)),
    });

    const results = await semanticSearch({ guildId: 'g1', channelId: 'c1', userId: 'u1', query: 'cumprimento' });
    expect(Array.isArray(results)).toBe(true);

    const removed = await deleteByGuild('g1');
    expect(removed).toBeGreaterThanOrEqual(1);

    await pruneOldMemories(30);
  }, 60_000);
});
