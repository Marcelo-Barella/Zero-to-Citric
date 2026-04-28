import { loadEnv } from '../env.js';
import { ok, err, type Result } from '../result.js';
import { pcmToWav } from './wav.js';

export async function transcribeOpenAI(pcm: Buffer): Promise<Result<string>> {
  const env = loadEnv();
  if (!env.OPENAI_API_KEY) return err('openai_not_configured');
  const wav = pcmToWav(pcm, 48000, 2);
  const form = new FormData();
  form.set('model', 'whisper-1');
  form.set('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'audio.wav');
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) return err(`openai_stt_${res.status}`);
  const json = (await res.json()) as { text?: string };
  return ok(json.text ?? '');
}
