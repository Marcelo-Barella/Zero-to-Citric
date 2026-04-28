import { tool } from 'ai';
import { z } from 'zod';
import type { BotContext } from './_context.js';
import { guildIdSchema, channelIdSchema, toolErr, toolOk } from './_shared.js';

export function MusicSpotifyPlayTool(ctx: BotContext) {
  return tool({
    description: 'Toca uma faixa a partir de um URI/URL do Spotify (resolve para o YouTube).',
    inputSchema: z.object({ guildId: guildIdSchema, channelId: channelIdSchema, spotifyUri: z.string().min(1).max(300) }),
    execute: async (input) => {
      const r = await ctx.voiceWorker.post<{ track: unknown; queuePosition: number }>('/worker/music/play', {
        guildId: input.guildId,
        channelId: input.channelId,
        query: input.spotifyUri,
        source: 'spotify',
      });
      if (!r.ok) return toolErr(r.error);
      return toolOk(r.data);
    },
  });
}
