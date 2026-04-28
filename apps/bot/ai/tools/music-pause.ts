import { tool } from 'ai';
import { z } from 'zod';
import type { BotContext } from './_context.js';
import { guildIdSchema, toolErr, toolOk } from './_shared.js';

export function MusicPauseTool(ctx: BotContext) {
  return tool({
    description: 'Pausa a faixa atual.',
    inputSchema: z.object({ guildId: guildIdSchema }),
    execute: async (input) => {
      const r = await ctx.voiceWorker.post<{ paused: true }>('/worker/music/pause', input);
      if (!r.ok) return toolErr(r.error);
      return toolOk(r.data);
    },
  });
}
