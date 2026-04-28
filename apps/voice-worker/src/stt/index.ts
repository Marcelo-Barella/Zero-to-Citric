import { loadEnv } from '../env.js';
import { type Result } from '../result.js';

export async function transcribe(pcm: Buffer): Promise<Result<string>> {
  const env = loadEnv();
  if (env.WHISPER_PROVIDER === 'sidecar') {
    const { transcribeSidecar } = await import('./sidecar.js');
    return transcribeSidecar(pcm);
  }
  if (env.WHISPER_PROVIDER === 'openai') {
    const { transcribeOpenAI } = await import('./openai.js');
    return transcribeOpenAI(pcm);
  }
  const { transcribeZhipu } = await import('./zhipu.js');
  return transcribeZhipu(pcm);
}
