import { Pool } from 'pg';
import { loadEnv } from '@/lib/env';

let pool: Pool | null = null;

export function db(): Pool {
  if (pool) return pool;
  const env = loadEnv();
  if (!env.POSTGRES_URL) throw new Error('postgres_not_configured');
  pool = new Pool({
    connectionString: env.POSTGRES_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
  });
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export interface InsertMemoryInput {
  guildId: string;
  channelId: string;
  userId: string;
  messageType: 'chat' | 'voice' | 'system';
  text: string;
  toolCalls: number;
  embedding: number[];
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export async function insertMemory(input: InsertMemoryInput): Promise<void> {
  await db().query(
    `insert into memories (guild_id, channel_id, user_id, message_type, text, tool_calls, embedding)
     values ($1, $2, $3, $4, $5, $6, $7::vector)`,
    [
      input.guildId,
      input.channelId,
      input.userId,
      input.messageType,
      input.text,
      input.toolCalls,
      toVectorLiteral(input.embedding),
    ],
  );
}

export interface SemanticSearchOpts {
  guildId: string;
  channelId: string;
  userId: string;
  query: string;
}

export async function semanticSearch(opts: SemanticSearchOpts): Promise<{ text: string; score: number }[]> {
  const env = loadEnv();
  const { embedText } = await import('./embed.js');
  const embedding = await embedText(opts.query);
  const res = await db().query<{ text: string; score: string }>(
    `select text, 1 - (embedding <=> $1::vector) as score
       from memories
      where guild_id = $2 and channel_id = $3 and user_id = $4
   order by embedding <=> $1::vector
      limit $5`,
    [
      toVectorLiteral(embedding),
      opts.guildId,
      opts.channelId,
      opts.userId,
      env.MAX_RETRIEVAL_RESULTS ?? 10,
    ],
  );
  const threshold = env.MEMORY_SIMILARITY_THRESHOLD ?? 0.6;
  return res.rows
    .map((r) => ({ text: r.text, score: Number(r.score) }))
    .filter((r) => r.score >= threshold);
}

export async function pruneOldMemories(retentionDays: number): Promise<number> {
  const res = await db().query(`delete from memories where ts < now() - ($1 || ' days')::interval`, [retentionDays]);
  return res.rowCount ?? 0;
}

export async function deleteByUser(guildId: string, userId: string): Promise<number> {
  const res = await db().query(`delete from memories where guild_id = $1 and user_id = $2`, [guildId, userId]);
  return res.rowCount ?? 0;
}

export async function deleteByGuild(guildId: string): Promise<number> {
  const res = await db().query(`delete from memories where guild_id = $1`, [guildId]);
  return res.rowCount ?? 0;
}

export const INIT_SQL = `
create extension if not exists vector;

create table if not exists memories (
  id            bigserial primary key,
  guild_id      text not null,
  channel_id    text not null,
  user_id       text not null,
  ts            timestamptz not null default now(),
  message_type  text not null check (message_type in ('chat','voice','system')),
  text          text not null,
  tool_calls    integer not null default 0,
  embedding     vector(1536) not null
);

create index if not exists memories_keys_idx on memories (guild_id, channel_id, user_id, ts desc);
create index if not exists memories_vec_idx on memories using hnsw (embedding vector_cosine_ops);
`;

export async function initSchema(): Promise<void> {
  await db().query(INIT_SQL);
}
