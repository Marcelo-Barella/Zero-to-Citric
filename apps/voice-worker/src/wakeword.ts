import { loadEnv } from './env.js';
import type { RpcListenStart } from '@zero-to-citric/shared-types';
import { ok, err, type Result } from './result.js';

const sessions = new Map<string, { stop: () => void }>();

function key(input: { guildId: string; channelId: string; userId: string }): string {
  return `${input.guildId}:${input.channelId}:${input.userId}`;
}

export function matchesWakeWord(transcript: string, wakeWord: string): boolean {
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const t = normalize(transcript);
  const w = normalize(wakeWord);
  if (!w) return false;
  const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  return re.test(t);
}

export async function startListening(input: RpcListenStart): Promise<Result<{ listening: true; windowMs: number }>> {
  const env = loadEnv();
  const k = key(input);
  if (sessions.has(k)) return ok({ listening: true as const, windowMs: env.WAKE_WINDOW_MS });
  // Detailed receiver/STT pipeline lives in ./voice/listen.ts when discord client is available
  try {
    const { startUserListenSession } = await import('./voice/listen.js');
    const session = await startUserListenSession(input);
    if (!session.ok) return err(session.error);
    sessions.set(k, { stop: session.data.stop });
    return ok({ listening: true as const, windowMs: env.WAKE_WINDOW_MS });
  } catch (e) {
    return err((e as Error).message);
  }
}

export function stopListening(input: { guildId: string; channelId: string; userId: string }): void {
  const k = key(input);
  sessions.get(k)?.stop();
  sessions.delete(k);
}
