import { loadEnv } from '../env.js';
import { ok, err, type Result } from '../result.js';

export async function synthesizePiper(text: string): Promise<Result<Buffer>> {
  const env = loadEnv();
  if (!env.PIPER_SIDECAR_URL) return err('piper_not_configured');
  const url = `${env.PIPER_SIDECAR_URL.replace(/\/$/, '')}/synthesize`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'audio/wav' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return err(`piper_${res.status}`);
  const arr = await res.arrayBuffer();
  return ok(Buffer.from(arr));
}
