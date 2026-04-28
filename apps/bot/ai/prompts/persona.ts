import { loadPersona, renderPersona, type PersonaContext, type PersonaInput } from '@zero-to-citric/persona';
import { loadEnv } from '@/lib/env';

export interface BuildPersonaInput {
  ctx: PersonaContext;
  toolList: string[];
}

export async function buildPersonaPrompt(input: BuildPersonaInput): Promise<string> {
  const env = loadEnv();
  const template = await loadPersona();
  const personaInput: PersonaInput = {
    ctx: input.ctx,
    locale: env.BOT_LOCALE,
    toolList: input.toolList,
  };
  return renderPersona(template, personaInput);
}
