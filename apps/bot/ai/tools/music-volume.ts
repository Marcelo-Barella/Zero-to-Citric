import { tool } from 'ai';
import { z } from 'zod';
import type { BotContext } from './_context.js';
import { guildIdSchema, toolErr, toolOk } from './_shared.js';

export function MusicVolumeTool(ctx: BotContext) {
  return tool({
    description: 'Ajusta o volume da música (0 a 100).',
    inputSchema: z.object({ guildId: guildIdSchema, volume: z.number().int().min(0).max(100) }),
    execute: async (input) => {
      const r = await ctx.voiceWorker.post<{ volume: number }>('/worker/music/volume', input);
      if (!r.ok) return toolErr(r.error);
      return toolOk(r.data);
    },
  });
}
