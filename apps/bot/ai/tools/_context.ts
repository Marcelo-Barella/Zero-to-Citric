import type { Logger } from 'pino';
import type { Channel, Message, Thread } from 'chat';
import type { Env } from '@/lib/env';
import type { VoiceWorkerClient } from '@/lib/voice-worker-client';

export interface BotContext {
  env: Env;
  log: Logger;
  thread: Thread;
  message: Message;
  channel: Channel;
  voiceWorker: VoiceWorkerClient;
  /** Discord guild id, when available. DMs have no guild. */
  guildId?: string;
  /** Discord channel id (== thread/channel id for Discord). */
  channelId: string;
  /** Discord user id of the message author. */
  userId: string;
}
