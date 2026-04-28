import { z } from 'zod';
import {
  guildIdSchema,
  channelIdSchema,
  userIdSchema,
  channelInfoSchema,
  trackSchema,
  queueItemSchema,
} from '@zero-to-citric/shared-types';

export const toolNames = [
  'GET_Canais',
  'GET_UserVoiceChannel',
  'SEND_Mensagem',
  'EnterChannel',
  'LeaveChannel',
  'MusicPlay',
  'MusicStop',
  'MusicSkip',
  'MusicPause',
  'MusicResume',
  'MusicVolume',
  'GET_MusicQueue',
  'MusicSpotifyPlay',
  'MusicLeave',
  'TTSSpeak',
  'WebSearch',
] as const;

export type ToolName = (typeof toolNames)[number];

export const getCanaisInputSchema = z.object({ guildId: guildIdSchema });
export const getCanaisOutputSchema = z.array(channelInfoSchema);

export const getUserVoiceChannelInputSchema = z.object({ guildId: guildIdSchema, userId: userIdSchema });
export const getUserVoiceChannelOutputSchema = z
  .object({ channelId: z.string(), channelName: z.string() })
  .nullable();

export const sendMensagemInputSchema = z.object({
  channelId: channelIdSchema,
  text: z.string().min(1).max(4000),
});
export const sendMensagemOutputSchema = z.object({ messageId: z.string() });

export const enterChannelInputSchema = z.object({ guildId: guildIdSchema, channelId: channelIdSchema });
export const enterChannelOutputSchema = z.object({ joined: z.literal(true) });

export const leaveChannelInputSchema = z.object({ guildId: guildIdSchema });
export const leaveChannelOutputSchema = z.object({ left: z.literal(true) });

export const musicPlayInputSchema = z.object({
  guildId: guildIdSchema,
  channelId: channelIdSchema,
  query: z.string().min(1).max(300),
});
export const musicPlayOutputSchema = z.object({ track: trackSchema, queuePosition: z.number().int() });

export const musicSimpleInputSchema = z.object({ guildId: guildIdSchema });

export const musicVolumeInputSchema = z.object({
  guildId: guildIdSchema,
  volume: z.number().int().min(0).max(100),
});
export const musicVolumeOutputSchema = z.object({ volume: z.number().int().min(0).max(100) });

export const musicQueueInputSchema = z.object({
  guildId: guildIdSchema,
  limit: z.number().int().min(1).max(25).optional(),
  offset: z.number().int().min(0).optional(),
  info_level: z.enum(['compact', 'full']).optional(),
  include_current: z.boolean().optional(),
});
export const musicQueueOutputSchema = z.object({
  current: queueItemSchema.nullable(),
  items: z.array(queueItemSchema),
  total: z.number().int().nonnegative(),
});

export const musicSpotifyPlayInputSchema = z.object({
  guildId: guildIdSchema,
  channelId: channelIdSchema,
  spotifyUri: z.string().min(1).max(300),
});

export const ttsSpeakInputSchema = z.object({
  guildId: guildIdSchema,
  channelId: channelIdSchema,
  text: z.string().min(1).max(2000),
});
export const ttsSpeakOutputSchema = z.object({ played: z.literal(true), durationMs: z.number().int().nonnegative() });

export const webSearchInputSchema = z.object({ query: z.string().min(1).max(400) });
export const webSearchOutputSchema = z.array(
  z.object({ title: z.string(), url: z.string(), snippet: z.string(), score: z.number() }),
);

export const toolInputSchemas: Record<ToolName, z.ZodTypeAny> = {
  GET_Canais: getCanaisInputSchema,
  GET_UserVoiceChannel: getUserVoiceChannelInputSchema,
  SEND_Mensagem: sendMensagemInputSchema,
  EnterChannel: enterChannelInputSchema,
  LeaveChannel: leaveChannelInputSchema,
  MusicPlay: musicPlayInputSchema,
  MusicStop: musicSimpleInputSchema,
  MusicSkip: musicSimpleInputSchema,
  MusicPause: musicSimpleInputSchema,
  MusicResume: musicSimpleInputSchema,
  MusicVolume: musicVolumeInputSchema,
  GET_MusicQueue: musicQueueInputSchema,
  MusicSpotifyPlay: musicSpotifyPlayInputSchema,
  MusicLeave: musicSimpleInputSchema,
  TTSSpeak: ttsSpeakInputSchema,
  WebSearch: webSearchInputSchema,
};
