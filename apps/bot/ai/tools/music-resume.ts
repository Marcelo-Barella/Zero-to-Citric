import { tool } from 'ai';
import { z } from 'zod';
import type { BotContext } from './_context.js';
import { guildIdSchema, toolErr, toolOk } from './_shared.js';

export function MusicResumeTool(ctx: BotContext) {
  return tool({
    description: 'Retoma a faixa pausada.',
    inputSchema: z.object({ guildId: guildIdSchema }),
    execute: async (input) => {
      const r = await ctx.voiceWorker.post<{ resumed: true }>('/worker/music/resume', input);
      if (!r.ok) return toolErr(r.error);
      return toolOk(r.data);
    },
  });
}
