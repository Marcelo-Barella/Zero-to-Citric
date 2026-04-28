import type { Env } from '@/lib/env';
import type { ToolName } from '@zero-to-citric/tools-contract';

const VOICE_TOOLS: ReadonlySet<ToolName> = new Set<ToolName>([
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
  'GET_UserVoiceChannel',
]);

export function canUseTool(name: ToolName, env: Env): boolean {
  if (VOICE_TOOLS.has(name)) return Boolean(env.WORKER_BASE_URL && env.WORKER_SHARED_SECRET);
  if (name === 'WebSearch') return Boolean(env.TAVILY_API_KEY) && env.WEB_SEARCH_ENABLED;
  return true;
}
