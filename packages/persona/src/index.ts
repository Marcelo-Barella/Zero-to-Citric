import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export interface SemanticHit {
  text: string;
  score: number;
}

export interface PersonaContext {
  recent: string[];
  semantic: SemanticHit[];
}

export interface PersonaInput {
  ctx: PersonaContext;
  locale?: string;
  toolList?: string[];
}

const PERSONA_FILENAME = 'tangerina_persona.md';

function packageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..');
}

let cached: string | null = null;

export async function loadPersona(): Promise<string> {
  if (cached !== null) return cached;
  const filePath = path.join(packageRoot(), PERSONA_FILENAME);
  cached = await readFile(filePath, 'utf8');
  return cached;
}

export function renderPersona(template: string, input: PersonaInput): string {
  const locale = input.locale ?? 'pt-BR';
  const toolList = input.toolList ?? [];
  const tools = toolList.length === 0 ? '(nenhuma tool registrada nesta interação)' : toolList.map((t) => `- ${t}`).join('\n');
  const recent = input.ctx.recent.length === 0 ? '(sem memória recente)' : input.ctx.recent.join('\n');
  const semantic =
    input.ctx.semantic.length === 0
      ? '(sem memória de longo prazo relevante)'
      : input.ctx.semantic.map((s) => `- (${s.score.toFixed(2)}) ${s.text}`).join('\n');
  return template
    .replaceAll('{{LOCALE}}', locale)
    .replaceAll('{{TOOLS}}', tools)
    .replaceAll('{{RECENT}}', recent)
    .replaceAll('{{SEMANTIC}}', semantic);
}

export async function persona(input: PersonaInput): Promise<string> {
  const template = await loadPersona();
  return renderPersona(template, input);
}
