import type { Chat } from 'chat';
import { onMention } from './handlers/onMention.js';
import { onSubscribedMessage } from './handlers/onSubscribedMessage.js';

export async function registerHandlers(chat: Chat): Promise<void> {
  chat.onNewMention(onMention);
  chat.onSubscribedMessage(onSubscribedMessage);
}
