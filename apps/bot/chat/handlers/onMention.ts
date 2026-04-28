import type { Message, Thread } from 'chat';
import { generateText } from 'ai';
import { gateway, llmModel } from '@/ai/gateway';
import { buildPersonaPrompt } from '@/ai/prompts/persona';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/ratelimit';

export async function onMention(thread: Thread, message: Message): Promise<void> {
  const log = logger().child({ handler: 'onMention', thread: thread.id });
  const text = (message.text ?? '').trim();
  if (!text) return;

  const limitKey = `mention:${thread.id}`;
  const limit = await checkRateLimit(limitKey);
  if (!limit.allowed) {
    await thread.post('Calma, estou recebendo muitas mensagens. Tenta de novo daqui a pouco.');
    return;
  }

  // M1 baseline: persona-only reply with no tools, no memory.
  // Tools, web search, n8n fan-out and memory are wired in handlers/onMentionFull.ts (loaded by M2+).
  try {
    const { runMentionPipeline } = await import('./onMentionFull.js');
    await runMentionPipeline({ thread, message, log });
  } catch (err) {
    log.warn({ err }, 'full pipeline unavailable, falling back to persona-only reply');
    const system = await buildPersonaPrompt({ ctx: { recent: [], semantic: [] }, toolList: [] });
    const result = await generateText({
      model: gateway()(llmModel()),
      system,
      messages: [{ role: 'user', content: text }],
    });
    if (result.text) await thread.post(result.text);
  }
}
