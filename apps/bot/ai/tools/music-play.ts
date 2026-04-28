import { tool } from 'ai';
import { z } from 'zod';
import type { BotContext } from './_context.js';
import { guildIdSchema, channelIdSchema, toolErr, toolOk } from './_shared.js';

export function MusicPlayTool(ctx: BotContext) {
  return tool({
    description: 'Toca uma música no canal de voz do servidor. Aceita link ou termo de busca (YouTube).',
    inputSchema: z.object({ guildId: guildIdSchema, channelId: channelIdSchema, query: z.string().min(1).max(300) }),
    execute: async (input) => {
      const r = await ctx.voiceWorker.post<{ track: unknown; queuePosition: number }>('/worker/music/play', input);
      if (!r.ok) return toolErr(r.error);
      return toolOk(r.data);
    },
  });
}
