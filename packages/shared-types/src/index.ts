import { z } from 'zod';

export const guildIdSchema = z.string().min(1, 'guildId required').describe('Discord guild (server) id');
export const channelIdSchema = z.string().min(1, 'channelId required').describe('Discord channel id');
export const userIdSchema = z.string().min(1, 'userId required').describe('Discord user id');

export const messageTypeSchema = z.enum(['chat', 'voice', 'system']);
export type MessageType = z.infer<typeof messageTypeSchema>;

export const toolErrorSchema = z.object({ ok: z.literal(false), error: z.string() });
export type ToolError = z.infer<typeof toolErrorSchema>;

export type ToolOk<T> = { ok: true; data: T };
export type ToolResult<T> = ToolOk<T> | ToolError;

export const channelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
});
export type ChannelInfo = z.infer<typeof channelInfoSchema>;

export const trackSchema = z.object({
  title: z.string(),
  url: z.string().url().optional(),
  duration: z.number().int().nonnegative().optional(),
  source: z.enum(['youtube', 'spotify']).optional(),
  requestedBy: z.string().optional(),
});
export type Track = z.infer<typeof trackSchema>;

export const queueItemSchema = z.object({
  position: z.number().int().nonnegative(),
  track: trackSchema,
});
export type QueueItem = z.infer<typeof queueItemSchema>;

// ---- RPC contracts ----
export const rpcVoiceJoinSchema = z.object({ guildId: guildIdSchema, channelId: channelIdSchema });
export type RpcVoiceJoin = z.infer<typeof rpcVoiceJoinSchema>;

export const rpcVoiceLeaveSchema = z.object({ guildId: guildIdSchema });
export type RpcVoiceLeave = z.infer<typeof rpcVoiceLeaveSchema>;

export const rpcMusicPlaySchema = z.object({
  guildId: guildIdSchema,
  channelId: channelIdSchema,
  query: z.string().min(1).max(300),
  source: z.enum(['youtube', 'spotify']).optional(),
});
export type RpcMusicPlay = z.infer<typeof rpcMusicPlaySchema>;

export const rpcMusicSimpleSchema = z.object({ guildId: guildIdSchema });
export type RpcMusicSimple = z.infer<typeof rpcMusicSimpleSchema>;

export const rpcMusicVolumeSchema = z.object({
  guildId: guildIdSchema,
  volume: z.number().int().min(0).max(100),
});
export type RpcMusicVolume = z.infer<typeof rpcMusicVolumeSchema>;

export const rpcQueueQuerySchema = z.object({
  guildId: guildIdSchema,
  limit: z.number().int().min(1).max(25).default(25),
  offset: z.number().int().min(0).default(0),
  info_level: z.enum(['compact', 'full']).default('compact'),
  include_current: z.boolean().default(true),
});
export type RpcQueueQuery = z.infer<typeof rpcQueueQuerySchema>;

export const rpcTtsSpeakSchema = z.object({
  guildId: guildIdSchema,
  channelId: channelIdSchema,
  text: z.string().min(1).max(2000),
  provider: z.enum(['elevenlabs', 'piper']).optional(),
});
export type RpcTtsSpeak = z.infer<typeof rpcTtsSpeakSchema>;

export const rpcListenStartSchema = z.object({
  guildId: guildIdSchema,
  channelId: channelIdSchema,
  userId: userIdSchema,
});
export type RpcListenStart = z.infer<typeof rpcListenStartSchema>;

export const rpcUserVoiceQuerySchema = z.object({
  guildId: guildIdSchema,
  userId: userIdSchema,
});
export type RpcUserVoiceQuery = z.infer<typeof rpcUserVoiceQuerySchema>;

// SSE event payloads
export const sseTranscriptSchema = z.object({
  guildId: guildIdSchema,
  channelId: channelIdSchema,
  userId: userIdSchema,
  text: z.string(),
});
export type SseTranscript = z.infer<typeof sseTranscriptSchema>;

export const sseTrackEndedSchema = z.object({
  guildId: guildIdSchema,
  track: trackSchema.optional(),
  reason: z.string().optional(),
});
export type SseTrackEnded = z.infer<typeof sseTrackEndedSchema>;
