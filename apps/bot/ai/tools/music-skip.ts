import { tool } from 'ai';
import { z } from 'zod';
import type { BotContext } from './_context.js';
import { guildIdSchema, toolErr, toolOk } from './_shared.js';

export function MusicSkipTool(ctx: BotContext) {
  return tool({
    description: 'Pula para a próxima faixa da fila.',
    inputSchema: z.object({ guildId: guildIdSchema }),
    execute: async (input) => {
      const r = await ctx.voiceWorker.post<{ skipped: true; next?: unknown }>('/worker/music/skip', input);
      if (!r.ok) return toolErr(r.error);
      return toolOk(r.data);
    },
  });
}
