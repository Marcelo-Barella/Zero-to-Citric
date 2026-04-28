import { tool } from 'ai';
import { z } from 'zod';
import type { BotContext } from './_context.js';
import { guildIdSchema, userIdSchema, toolErr, toolOk } from './_shared.js';

export function GetUserVoiceChannelTool(ctx: BotContext) {
  return tool({
    description: 'Retorna o canal de voz atual em que o usuário está conectado, ou null.',
    inputSchema: z.object({ guildId: guildIdSchema, userId: userIdSchema }),
    execute: async ({ guildId, userId }) => {
      const r = await ctx.voiceWorker.get<{ channelId: string; channelName: string } | null>(
        '/worker/voice-channel',
        { guildId, userId },
      );
      if (!r.ok) return toolErr(r.error);
      return toolOk(r.data);
    },
  });
}
