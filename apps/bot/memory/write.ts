import { loadEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

export interface RememberInput {
  guildId: string;
  channelId: string;
  userId: string;
  userText: string;
  botText: string;
  messageType?: 'chat' | 'voice' | 'system';
  toolCalls?: number;
}

export async function rememberTurn(input: RememberInput): Promise<void> {
  const env = loadEnv();
  if (!env.MEMORY_ENABLED) return;
  const log = logger().child({ component: 'memory.write' });
  try {
    const [{ pushRecent }, { insertMemory }, { embedText }] = await Promise.all([
      import('./redis.js'),
      import('./db.js'),
      import('./embed.js'),
    ]);
    const text = `User: ${input.userText}\nBot: ${input.botText}`;
    const embedding = await embedText(text);
    await Promise.all([
      pushRecent(input.guildId, input.channelId, input.userId, text),
      insertMemory({
        guildId: input.guildId,
        channelId: input.channelId,
        userId: input.userId,
        messageType: input.messageType ?? 'chat',
        text,
        toolCalls: input.toolCalls ?? 0,
        embedding,
      }),
    ]);
  } catch (err) {
    log.warn({ err }, 'rememberTurn failed');
  }
}
