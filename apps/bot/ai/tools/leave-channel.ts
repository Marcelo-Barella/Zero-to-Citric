import { tool } from 'ai';
import { z } from 'zod';
import type { BotContext } from './_context.js';
import { guildIdSchema, toolErr, toolOk } from './_shared.js';

export function LeaveChannelTool(ctx: BotContext) {
  return tool({
    description: 'Faz o bot sair do canal de voz.',
    inputSchema: z.object({ guildId: guildIdSchema }),
    execute: async (input) => {
      const r = await ctx.voiceWorker.post<{ left: true }>('/worker/voice/leave', input);
      if (!r.ok) return toolErr(r.error);
      return toolOk(r.data);
    },
  });
}
