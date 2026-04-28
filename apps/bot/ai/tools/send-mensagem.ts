import { tool } from 'ai';
import { z } from 'zod';
import type { BotContext } from './_context.js';
import { channelIdSchema, toolErr, toolOk } from './_shared.js';

export function SendMensagemTool(ctx: BotContext) {
  return tool({
    description:
      'ÚNICA forma de enviar uma mensagem visível em um canal de Discord. Use sempre esta tool ao responder ao usuário.',
    inputSchema: z.object({ channelId: channelIdSchema, text: z.string().min(1).max(4000) }),
    execute: async ({ channelId, text }) => {
      try {
        if (channelId !== ctx.channelId) {
          // Cross-channel posting: post via Discord REST.
          if (!ctx.env.DISCORD_BOT_TOKEN) return toolErr('discord_token_unavailable');
          const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              authorization: `Bot ${ctx.env.DISCORD_BOT_TOKEN}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ content: text }),
          });
          if (!res.ok) return toolErr(`discord_${res.status}`);
          const json = (await res.json()) as { id: string };
          return toolOk({ messageId: json.id });
        }
        const sent = await ctx.thread.post(text);
        return toolOk({ messageId: sent.id });
      } catch (err) {
        return toolErr((err as Error).message);
      }
    },
  });
}
