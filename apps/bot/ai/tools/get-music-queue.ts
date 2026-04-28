import { tool } from 'ai';
import { z } from 'zod';
import type { BotContext } from './_context.js';
import { guildIdSchema, toolErr, toolOk } from './_shared.js';

export function GetMusicQueueTool(ctx: BotContext) {
  return tool({
    description: 'Retorna a fila atual de músicas, com a faixa atual e itens pendentes.',
    inputSchema: z.object({
      guildId: guildIdSchema,
      limit: z.number().int().min(1).max(25).optional(),
      offset: z.number().int().min(0).optional(),
      info_level: z.enum(['compact', 'full']).optional(),
      include_current: z.boolean().optional(),
    }),
    execute: async (input) => {
      const r = await ctx.voiceWorker.get<{ current: unknown; items: unknown[]; total: number }>('/worker/music/queue', {
        guildId: input.guildId,
        limit: input.limit ?? 25,
        offset: input.offset ?? 0,
        info_level: input.info_level ?? 'compact',
        include_current: input.include_current ?? true,
      });
      if (!r.ok) return toolErr(r.error);
      return toolOk(r.data);
    },
  });
}
