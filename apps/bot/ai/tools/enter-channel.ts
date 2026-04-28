import { tool } from 'ai';
import { z } from 'zod';
import type { BotContext } from './_context.js';
import { guildIdSchema, channelIdSchema, toolErr, toolOk } from './_shared.js';

export function EnterChannelTool(ctx: BotContext) {
  return tool({
    description: 'Faz o bot entrar em um canal de voz.',
    inputSchema: z.object({ guildId: guildIdSchema, channelId: channelIdSchema }),
    execute: async (input) => {
      const r = await ctx.voiceWorker.post<{ joined: true }>('/worker/voice/join', input);
      if (!r.ok) return toolErr(r.error);
      return toolOk(r.data);
    },
  });
}
