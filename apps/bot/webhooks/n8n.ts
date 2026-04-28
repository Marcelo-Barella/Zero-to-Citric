import type { Channel, Message, Thread } from 'chat';
import { loadEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

export interface FanOutInput {
  thread: Thread;
  channel: Channel;
  message: Message;
  responseText: string;
  toolCalls: Array<{ toolName: string; args?: unknown; result?: unknown }>;
  guildId?: string;
  channelId: string;
  userId: string;
}

export async function fanOutToN8n(input: FanOutInput): Promise<void> {
  const env = loadEnv();
  if (!env.N8N_WEBHOOK_URL) return;
  const log = logger().child({ component: 'n8n' });
  const payload = {
    timestamp: new Date().toISOString(),
    locale: env.BOT_LOCALE,
    guild_id: input.guildId ?? null,
    channel_id: input.channelId,
    user_id: input.userId,
    user: {
      id: input.message.author.userId,
      name: input.message.author.userName,
      display_name: input.message.author.fullName,
      is_bot: input.message.author.isBot,
    },
    message: {
      id: input.message.id,
      text: input.message.text,
      attachments: input.message.attachments?.map((a) => ({
        id: (a as { id?: string }).id ?? null,
        url: (a as { url?: string }).url ?? null,
        contentType: (a as { contentType?: string }).contentType ?? null,
      })) ?? [],
    },
    response: { text: input.responseText },
    tool_calls: input.toolCalls,
  };
  try {
    const res = await fetch(env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) log.warn({ status: res.status }, 'n8n non-2xx');
  } catch (err) {
    log.error({ err }, 'n8n fan-out failed');
  }
}
