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
