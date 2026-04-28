import { z } from 'zod';
import { generateText } from 'ai';
import { gateway, llmModel } from '@/ai/gateway';
import { buildPersonaPrompt } from '@/ai/prompts/persona';
import { assertApiKey, assertContentType, AuthError } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
  message: z.string().min(1).max(4000),
  context: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      }),
    )
    .optional(),
});

export async function POST(req: Request): Promise<Response> {
  const log = logger().child({ route: '/api/chat' });
  try {
    assertApiKey(req);
    assertContentType(req);
  } catch (err) {
    if (err instanceof AuthError) return err.toResponse();
    throw err;
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }
  const system = await buildPersonaPrompt({ ctx: { recent: [], semantic: [] }, toolList: [] });
  try {
    const result = await generateText({
      model: gateway()(llmModel()),
      system,
      messages: [
        ...((parsed.data.context ?? []) as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>),
        { role: 'user' as const, content: parsed.data.message },
      ],
    });
    return Response.json({ success: true, response: result.text });
  } catch (err) {
    log.error({ err }, 'chat generation failed');
    return Response.json({ error: 'generation_failed' }, { status: 500 });
  }
}
