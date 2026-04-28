import { loadEnv } from '../env.js';
import { ok, err, type Result } from '../result.js';
import { pcmToWav } from './wav.js';

export async function transcribeZhipu(pcm: Buffer): Promise<Result<string>> {
  const env = loadEnv();
  if (!env.ZHIPU_API_KEY) return err('zhipu_not_configured');
  const wav = pcmToWav(pcm, 48000, 2);
  const form = new FormData();
  form.set('model', 'GLM-ASR-2512');
  form.set('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'audio.wav');
  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/audio/transcriptions', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.ZHIPU_API_KEY}` },
    body: form,
  });
  if (!res.ok) return err(`zhipu_stt_${res.status}`);
  const json = (await res.json()) as { text?: string };
  return ok(json.text ?? '');
}
