import { Chat, type ChatInstance, ConsoleLogger } from 'chat';
import type { DiscordAdapter } from '@chat-adapter/discord';
import { buildDiscordAdapter, buildStateAdapter } from './adapters.js';
import { loadEnv } from '@/lib/env';
import { logger } from '@/lib/logger';

export interface AppBot extends ChatInstance {
  adapters: { discord: DiscordAdapter };
}

let botPromise: Promise<AppBot> | null = null;

export function getBot(): Promise<AppBot> {
  if (!botPromise) botPromise = build();
  return botPromise;
}

async function build(): Promise<AppBot> {
  const env = loadEnv();
  const log = logger();
  const discord = buildDiscordAdapter();
  const state = buildStateAdapter();
  const chat = new Chat({
    userName: 'Tangerina',
    adapters: { discord },
    state,
    logger: new ConsoleLogger(env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | 'silent'),
  });
  log.info({ locale: env.BOT_LOCALE, model: env.LLM_MODEL }, 'building chat bot');
  // Register handlers (lazy import to avoid circular deps with tools)
  const { registerHandlers } = await import('./register.js');
  await registerHandlers(chat);
  await chat.initialize();
  return chat as unknown as AppBot;
}

export function resetBotForTesting(): void {
  botPromise = null;
}
