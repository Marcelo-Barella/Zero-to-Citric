import { tool } from 'ai';
import { z } from 'zod';
import type { BotContext } from './_context.js';
import { guildIdSchema, toolErr, toolOk } from './_shared.js';

export function MusicStopTool(ctx: BotContext) {
  return tool({
    description: 'Interrompe a música atual e limpa a fila.',
    inputSchema: z.object({ guildId: guildIdSchema }),
    execute: async (input) => {
      const r = await ctx.voiceWorker.post<{ stopped: true }>('/worker/music/stop', input);
      if (!r.ok) return toolErr(r.error);
      return toolOk(r.data);
    },
  });
}
