import { tool } from 'ai';
import { z } from 'zod';
import type { BotContext } from './_context.js';
import { guildIdSchema, toolErr, toolOk } from './_shared.js';

export function GetCanaisTool(ctx: BotContext) {
  return tool({
    description: 'Lista os canais (texto e voz) de um servidor (guild).',
    inputSchema: z.object({ guildId: guildIdSchema }),
    execute: async ({ guildId }) => {
      if (!ctx.env.DISCORD_BOT_TOKEN) return toolErr('discord_token_unavailable');
      const url = `https://discord.com/api/v10/guilds/${guildId}/channels`;
      const res = await fetch(url, {
        headers: { authorization: `Bot ${ctx.env.DISCORD_BOT_TOKEN}` },
      });
      if (!res.ok) return toolErr(`discord_${res.status}`);
      const channels = (await res.json()) as Array<{ id: string; name: string; type: number }>;
      const map: Record<number, string> = {
        0: 'GuildText',
        2: 'GuildVoice',
        4: 'GuildCategory',
        5: 'GuildAnnouncement',
        13: 'GuildStageVoice',
        15: 'GuildForum',
        16: 'GuildMedia',
      };
      return toolOk(channels.map((c) => ({ id: c.id, name: c.name, type: map[c.type] ?? `Type${c.type}` })));
    },
  });
}
