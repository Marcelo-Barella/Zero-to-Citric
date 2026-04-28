import { embed } from 'ai';
import { gateway, embeddingModel } from '@/ai/gateway';

export async function embedText(text: string): Promise<number[]> {
  const result = await embed({
    model: gateway().textEmbeddingModel(embeddingModel()),
    value: text,
  });
  return result.embedding;
}
