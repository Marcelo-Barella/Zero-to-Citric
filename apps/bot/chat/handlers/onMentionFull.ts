import type { Logger } from 'pino';
import type { Message, Thread } from 'chat';
import { generateText, stepCountIs, type ToolSet, type TypedToolCall, type TypedToolResult } from 'ai';
import { gateway, llmModel } from '@/ai/gateway';
import { buildPersonaPrompt } from '@/ai/prompts/persona';
import { buildTools, listAvailableToolNames } from '@/ai/tools';
import { loadEnv } from '@/lib/env';
import { voiceWorker } from '@/lib/voice-worker-client';
import { fanOutToN8n } from '@/webhooks/n8n';
import { retrieveContext } from '@/memory/retrieve';
import { rememberTurn } from '@/memory/write';
import type { BotContext } from '@/ai/tools/_context';

export interface MentionPipelineInput {
  thread: Thread;
  message: Message;
  log: Logger;
}

interface DiscordRaw {
  guildId?: string;
  channelId?: string;
  threadId?: string;
}

function decodeChannelIds(thread: Thread, message: Message): { guildId?: string; channelId: string } {
  // For Discord adapter, threadId encodes guild+channel as a JSON-ish string.
  // The Channel.id property already maps to the discord channel id.
  const channelId = thread.channel.id;
  let guildId: string | undefined;
  try {
    const decoded = JSON.parse(thread.id) as DiscordRaw;
    guildId = decoded.guildId && decoded.guildId !== '@me' ? decoded.guildId : undefined;
  } catch {
    /* non-discord adapter or non-JSON id; leave guildId undefined */
  }
  return { guildId, channelId };
}

export async function runMentionPipeline(input: MentionPipelineInput): Promise<void> {
  const { thread, message, log } = input;
  const env = loadEnv();
  const text = (message.text ?? '').trim();
  if (!text) return;

  const { guildId, channelId } = decodeChannelIds(thread, message);
  const userId = message.author.userId;

  const ctx: BotContext = {
    env,
    log,
    thread,
    message,
    channel: thread.channel,
    voiceWorker,
    guildId,
    channelId,
    userId,
  };

  const tools = buildTools(ctx) as ToolSet;
  const toolNames = listAvailableToolNames(env);

  // Memory retrieval (graceful no-op when MEMORY_ENABLED=false)
  const memoryCtx = guildId
    ? await retrieveContext({ guildId, channelId, userId, query: text }).catch((err) => {
        log.warn({ err }, 'memory retrieval failed');
        return { recent: [], semantic: [] };
      })
    : { recent: [], semantic: [] };

  const system = await buildPersonaPrompt({ ctx: memoryCtx, toolList: toolNames });

  const result = await generateText({
    model: gateway()(llmModel()),
    system,
    messages: [{ role: 'user', content: text }],
    tools,
    stopWhen: stepCountIs(10),
  });

  // The persona instructs the model to use SEND_Mensagem to talk to Discord.
  // If the model emitted plain text instead, post it as a fallback so users see something.
  const toolCalls = (result.toolCalls ?? []) as TypedToolCall<ToolSet>[];
  const toolResults = (result.toolResults ?? []) as TypedToolResult<ToolSet>[];
  const usedSendMensagem = toolCalls.some((tc) => tc.toolName === 'SEND_Mensagem');
  if (result.text && !usedSendMensagem) {
    try {
      await thread.post(result.text);
    } catch (err) {
      log.warn({ err }, 'thread.post failed');
    }
  }

  if (guildId) {
    await rememberTurn({
      guildId,
      channelId,
      userId,
      userText: text,
      botText: result.text ?? '',
      toolCalls: result.toolCalls?.length ?? 0,
    }).catch((err) => log.warn({ err }, 'memory write failed'));
  }

  await fanOutToN8n({
    thread,
    channel: thread.channel,
    message,
    responseText: result.text ?? '',
    toolCalls: toolCalls.map((tc) => ({
      toolName: tc.toolName,
      args: tc.input,
      result: matchToolResult(tc, toolResults),
    })),
    guildId,
    channelId,
    userId,
  });
}

function matchToolResult(tc: TypedToolCall<ToolSet>, results: TypedToolResult<ToolSet>[]): unknown {
  const r = results.find((x) => x.toolCallId === tc.toolCallId);
  if (!r) return undefined;
  return 'output' in r ? r.output : undefined;
}
