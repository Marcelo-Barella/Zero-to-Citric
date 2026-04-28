import { tool } from 'ai';
import { z } from 'zod';
import type { BotContext } from './_context.js';
import { guildIdSchema, toolErr, toolOk } from './_shared.js';

/**
 * Alias for LeaveChannel. Kept for parity with Tangerina.
 * @deprecated use LeaveChannel
 */
export function MusicLeaveTool(ctx: BotContext) {
  return tool({
    description: '(deprecated, use LeaveChannel) Faz o bot sair do canal de voz.',
    inputSchema: z.object({ guildId: guildIdSchema }),
    execute: async (input) => {
      const r = await ctx.voiceWorker.post<{ left: true }>('/worker/voice/leave', input);
      if (!r.ok) return toolErr(r.error);
      return toolOk(r.data);
    },
  });
}
