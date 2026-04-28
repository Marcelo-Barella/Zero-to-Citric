import { registerOTel } from '@vercel/otel';
import { loadEnv } from './env.js';

let registered = false;

export function registerObservability(): void {
  if (registered) return;
  const env = loadEnv();
  registerOTel({
    serviceName: 'zero-to-citric-bot',
    attributes: { 'service.version': env.APP_VERSION },
  });
  registered = true;
}
