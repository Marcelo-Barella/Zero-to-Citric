import { loadEnv } from '../env.js';
import { ok, err, type Result } from '../result.js';

export async function synthesizeElevenLabs(text: string): Promise<Result<Buffer>> {
  const env = loadEnv();
  if (!env.ELEVEN_API_KEY) return err('elevenlabs_not_configured');
  const voice = env.ELEVEN_VOICE_ID;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVEN_API_KEY,
      'content-type': 'application/json',
      accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.4, similarity_boost: 0.7 },
    }),
  });
  if (!res.ok) return err(`elevenlabs_${res.status}`);
  const arr = await res.arrayBuffer();
  return ok(Buffer.from(arr));
}
