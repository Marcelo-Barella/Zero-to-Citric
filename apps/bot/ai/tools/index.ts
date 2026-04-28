import type { ToolName } from '@zero-to-citric/tools-contract';
import type { BotContext } from './_context.js';
import { canUseTool } from './_policy.js';
import { GetCanaisTool } from './get-canais.js';
import { GetUserVoiceChannelTool } from './get-user-voice-channel.js';
import { SendMensagemTool } from './send-mensagem.js';
import { EnterChannelTool } from './enter-channel.js';
import { LeaveChannelTool } from './leave-channel.js';
import { MusicPlayTool } from './music-play.js';
import { MusicStopTool } from './music-stop.js';
import { MusicSkipTool } from './music-skip.js';
import { MusicPauseTool } from './music-pause.js';
import { MusicResumeTool } from './music-resume.js';
import { MusicVolumeTool } from './music-volume.js';
import { GetMusicQueueTool } from './get-music-queue.js';
import { MusicSpotifyPlayTool } from './music-spotify-play.js';
import { MusicLeaveTool } from './music-leave.js';
import { TtsSpeakTool } from './tts-speak.js';
import { WebSearchTool } from './web-search.js';

export type ToolFactories = Record<ToolName, (ctx: BotContext) => unknown>;

export const factories: ToolFactories = {
  GET_Canais: GetCanaisTool,
  GET_UserVoiceChannel: GetUserVoiceChannelTool,
  SEND_Mensagem: SendMensagemTool,
  EnterChannel: EnterChannelTool,
  LeaveChannel: LeaveChannelTool,
  MusicPlay: MusicPlayTool,
  MusicStop: MusicStopTool,
  MusicSkip: MusicSkipTool,
  MusicPause: MusicPauseTool,
  MusicResume: MusicResumeTool,
  MusicVolume: MusicVolumeTool,
  GET_MusicQueue: GetMusicQueueTool,
  MusicSpotifyPlay: MusicSpotifyPlayTool,
  MusicLeave: MusicLeaveTool,
  TTSSpeak: TtsSpeakTool,
  WebSearch: WebSearchTool,
};

export function buildTools(ctx: BotContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, factory] of Object.entries(factories) as Array<[ToolName, (ctx: BotContext) => unknown]>) {
    if (!canUseTool(name, ctx.env)) continue;
    out[name] = factory(ctx);
  }
  return out;
}

export function listAvailableToolNames(env: BotContext['env']): ToolName[] {
  return (Object.keys(factories) as ToolName[]).filter((n) => canUseTool(n, env));
}
