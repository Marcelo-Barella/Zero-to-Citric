import type { Message, Thread } from 'chat';
import { onMention } from './onMention.js';
import { loadEnv } from '@/lib/env';

export async function onSubscribedMessage(thread: Thread, message: Message): Promise<void> {
  const env = loadEnv();
  const text = (message.text ?? '').toLowerCase();
  if (!text.includes(env.WAKE_WORD.toLowerCase())) return;
  await onMention(thread, message);
}
