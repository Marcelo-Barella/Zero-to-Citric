# 04 — Memory and RAG

Replaces Tangerina's ChromaDB-on-disk memory with a serverless-friendly stack while keeping the same retrieval semantics.

## Tangerina behavior to preserve

From `chatbot/memory_manager.py`:

- Each turn stores a doc shaped `"User: <text>\nBot: <reply>"` keyed by `guild_id`, `channel_id`, `user_id`, `timestamp`, `message_type`, optional `tool_call_count`.
- Retrieval returns `{ recent, semantic }`:
  - `recent` = last N entries from an in-process deque per `(guild_id, channel_id, user_id)`. Default N = 10.
  - `semantic` = top-K cosine matches from ChromaDB filtered by the same key tuple. Default K = `MAX_RETRIEVAL_RESULTS=10`.
- Threshold `MEMORY_SIMILARITY_THRESHOLD` filters semantic hits (note README says 0.7, `.env.example` says 0.3 — pick **0.6** as the new default and document).
- TTL `MEMORY_RETENTION_DAYS=30`.
- Admin operations: `delete_by_user`, `delete_by_guild`.

## Target stack

| Need              | Choice                                                                |
| ----------------- | --------------------------------------------------------------------- |
| Vector store      | Postgres + `pgvector` (Vercel Postgres or Neon).                      |
| Embeddings        | `ai` SDK `embed()` via AI Gateway. Default model: `openai/text-embedding-3-small` (1536 dims). |
| Recent buffer     | Redis (Upstash) sorted set, `ZADD` on write, `ZRANGEBYSCORE` on read. |
| Cron / cleanup    | Vercel Cron job hitting `/api/cron/memory-prune`.                     |

## Schema

```sql
create extension if not exists vector;

create table memories (
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

create index memories_keys_idx on memories (guild_id, channel_id, user_id, ts desc);
create index memories_vec_idx  on memories using hnsw (embedding vector_cosine_ops);
```

`text` stores the same `"User: …\nBot: …"` packed string Tangerina uses, so prompt formatting is one-to-one.

## Write path

```ts
// apps/bot/memory/write.ts
import { embed } from 'ai';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';

export async function rememberTurn(input: {
  guildId: string; channelId: string; userId: string;
  userText: string; botText: string;
  messageType?: 'chat' | 'voice' | 'system';
  toolCalls?: number;
}) {
  if (env.MEMORY_ENABLED !== 'true') return;
  const text = `User: ${input.userText}\nBot: ${input.botText}`;
  const { embedding } = await embed({
    model: gateway(env.EMBEDDING_MODEL ?? 'openai/text-embedding-3-small'),
    value: text,
  });
  await db.execute(/* sql */`
    insert into memories (guild_id, channel_id, user_id, message_type, text, tool_calls, embedding)
    values ($1, $2, $3, $4, $5, $6, $7)
  `, [input.guildId, input.channelId, input.userId, input.messageType ?? 'chat', text, input.toolCalls ?? 0, embedding]);

  const key = `recent:${input.guildId}:${input.channelId}:${input.userId}`;
  await redis.zadd(key, { score: Date.now(), member: text });
  await redis.zremrangebyrank(key, 0, -11); // keep last 10
  await redis.expire(key, 60 * 60 * 24 * env.MEMORY_RETENTION_DAYS);
}
```

## Read path

```ts
// apps/bot/memory/retrieve.ts
export async function retrieveContext(opts: {
  guildId: string; channelId: string; userId: string; query: string;
}): Promise<{ recent: string[]; semantic: { text: string; score: number }[] }> {
  const recent = (await redis.zrange(
    `recent:${opts.guildId}:${opts.channelId}:${opts.userId}`,
    -10, -1
  )) as string[];

  if (env.MEMORY_ENABLED !== 'true') return { recent, semantic: [] };

  const { embedding } = await embed({
    model: gateway(env.EMBEDDING_MODEL ?? 'openai/text-embedding-3-small'),
    value: opts.query,
  });
  const rows = await db.query<{ text: string; score: number }>(/* sql */`
    select text, 1 - (embedding <=> $1) as score
    from memories
    where guild_id = $2 and channel_id = $3 and user_id = $4
    order by embedding <=> $1
    limit $5
  `, [embedding, opts.guildId, opts.channelId, opts.userId, env.MAX_RETRIEVAL_RESULTS ?? 10]);
  const filtered = rows.filter(r => r.score >= (env.MEMORY_SIMILARITY_THRESHOLD ?? 0.6));
  return { recent, semantic: filtered };
}
```

## Prompt integration

The persona prompt receives both lists and renders them:

```
[Memória recente]
{recent.join('\n')}

[Memória de longo prazo (relevante)]
{semantic.map(s => `- ${s.text}`).join('\n')}
```

Identical structure to Tangerina's persona block. The persona file itself stays in `packages/persona/tangerina_persona.md`.

## Retention and prune

```ts
// apps/bot/app/api/cron/memory-prune/route.ts
export const runtime = 'nodejs';
export async function GET(req: Request) {
  if (req.headers.get('x-vercel-cron') !== '1') return new Response('forbidden', { status: 403 });
  const days = env.MEMORY_RETENTION_DAYS ?? 30;
  const removed = await db.execute(/* sql */`
    delete from memories where ts < now() - ($1 || ' days')::interval
  `, [days]);
  return Response.json({ removed: removed.rowCount });
}
```

`vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/memory-prune", "schedule": "0 4 * * *" }] }
```

## Admin / forget

`POST /api/memory/forget` body `{ scope: 'user' | 'guild', guildId, userId? }`. Auth via `ADMIN_TOKEN` env. Mirrors Tangerina's `delete_by_user` and `delete_by_guild`.

## Tunables (env)

| Var                            | Default | Source                              |
| ------------------------------ | ------- | ----------------------------------- |
| `MEMORY_ENABLED`               | `false` | Tangerina default                   |
| `MAX_RETRIEVAL_RESULTS`        | `10`    | Tangerina                           |
| `MEMORY_SIMILARITY_THRESHOLD`  | `0.6`   | Reconciled from Tangerina mismatch  |
| `MEMORY_RETENTION_DAYS`        | `30`    | Tangerina                           |
| `EMBEDDING_MODEL`              | `openai/text-embedding-3-small` | New |
| `EMBEDDING_PROVIDER`           | inferred from model id | New                  |

## Migration note (Tangerina → here)

`deploy/migrate-chromadb.sh` exists in the source repo. We provide a one-shot `scripts/import-chromadb.ts` that reads the persisted Chroma sqlite (path from `CHROMADB_PATH`), re-embeds with the gateway model, and bulk-inserts into Postgres. Optional, only relevant if a user is migrating an existing Tangerina deployment.
