import { loadEnv } from '../env.js';
import { ok, err, type Result } from '../result.js';
import { pcmToWav } from './wav.js';

export async function transcribeSidecar(pcm: Buffer): Promise<Result<string>> {
  const env = loadEnv();
  if (!env.WHISPER_SIDECAR_URL) return err('sidecar_not_configured');
  const wav = pcmToWav(pcm, 48000, 2);
  const url = `${env.WHISPER_SIDECAR_URL.replace(/\/$/, '')}/transcribe`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'audio/wav' },
    body: new Uint8Array(wav),
  });
  if (!res.ok) return err(`sidecar_stt_${res.status}`);
  const json = (await res.json()) as { text?: string };
  return ok(json.text ?? '');
}
