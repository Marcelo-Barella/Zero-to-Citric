import { createGateway, type GatewayProvider } from '@ai-sdk/gateway';
import { loadEnv } from '@/lib/env';

let cached: GatewayProvider | null = null;

export function gateway(): GatewayProvider {
  if (cached) return cached;
  const env = loadEnv();
  cached = createGateway({
    apiKey: env.AI_GATEWAY_API_KEY ?? undefined,
  });
  return cached;
}

export function resetGatewayForTesting(): void {
  cached = null;
}

export function llmModel(): string {
  return loadEnv().LLM_MODEL;
}

export function embeddingModel(): string {
  return loadEnv().EMBEDDING_MODEL;
}
