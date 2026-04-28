import { tool } from 'ai';
import { z } from 'zod';
import type { BotContext } from './_context.js';
import { guildIdSchema, channelIdSchema, toolErr, toolOk } from './_shared.js';

export function TtsSpeakTool(ctx: BotContext) {
  return tool({
    description: 'Sintetiza voz e toca no canal de voz (provider-agnostic).',
    inputSchema: z.object({
      guildId: guildIdSchema,
      channelId: channelIdSchema,
      text: z.string().min(1).max(2000),
    }),
    execute: async (input) => {
      const r = await ctx.voiceWorker.post<{ played: true; durationMs: number }>('/worker/tts/speak', input);
      if (!r.ok) return toolErr(r.error);
      return toolOk(r.data);
    },
  });
}
