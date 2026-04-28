import { loadEnv } from '../env.js';
import { ok, err, type Result } from '../result.js';

export interface SpeakOpts {
  guildId: string;
  channelId: string;
  provider?: 'elevenlabs' | 'piper';
}

export async function speak(text: string, opts: SpeakOpts): Promise<Result<{ played: true; durationMs: number }>> {
  const env = loadEnv();
  const provider = opts.provider ?? env.TTS_PROVIDER;
  let buffer: Buffer;
  if (provider === 'piper') {
    const { synthesizePiper } = await import('./piper.js');
    const r = await synthesizePiper(text);
    if (!r.ok) return err(r.error);
    buffer = r.data;
  } else {
    const { synthesizeElevenLabs } = await import('./elevenlabs.js');
    const r = await synthesizeElevenLabs(text);
    if (!r.ok) return err(r.error);
    buffer = r.data;
  }
  const { playTts } = await import('./play.js');
  const r = await playTts(opts.guildId, opts.channelId, buffer);
  if (!r.ok) return err(r.error);
  return ok({ played: true as const, durationMs: r.data.durationMs });
}
