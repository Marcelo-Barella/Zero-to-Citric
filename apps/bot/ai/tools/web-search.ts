import { tool } from 'ai';
import { z } from 'zod';
import type { BotContext } from './_context.js';
import { tavilySearch } from '@/search/tavily';
import { toolErr, toolOk } from './_shared.js';

export function WebSearchTool(ctx: BotContext) {
  return tool({
    description: 'Busca informações atualizadas na web via Tavily.',
    inputSchema: z.object({ query: z.string().min(1).max(400) }),
    execute: async ({ query }) => {
      if (!ctx.env.TAVILY_API_KEY) return toolErr('web_search_disabled');
      const r = await tavilySearch(query, { maxResults: 5 });
      if (!r.ok) return toolErr(r.error);
      return toolOk(r.data);
    },
  });
}
