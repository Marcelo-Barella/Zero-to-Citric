# 07 — Persona and Language

## Goal

Preserve Tangerina's persona (Brazilian Portuguese, helpful, slightly playful) and the structured prompt that exposes tools + memory. Source: `chatbot/tangerina_persona.txt` (loaded by `BaseChatbot._load_persona`).

## Persona file location

`packages/persona/tangerina_persona.md` — markdown so we can ship sections cleanly.

## Required sections (one-to-one with Tangerina prompt blocks)

1. **Identidade** — name, role, locale, voice/tone.
2. **Capacidades** — high-level summary of what the bot can do (text, music, voice, search, memory).
3. **Regras de saída** — must use `SEND_Mensagem` to talk in Discord channels; must respond in pt-BR by default; may switch language if user does first; must call `WebSearch` before claiming current facts when memory is empty.
4. **Ferramentas disponíveis** — short bullet for each registered tool (auto-generated at runtime from `tools` registry, not hand-written).
5. **Contexto da conversa** — placeholders for `[Memória recente]` and `[Memória de longo prazo (relevante)]`.
6. **Restrições** — no role-play as another assistant, no generation of harmful content, no fabricated tool results.

## Loader

```ts
// packages/persona/src/index.ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function loadPersona(): Promise<string> {
  const p = path.join(process.cwd(), 'packages/persona/tangerina_persona.md');
  return readFile(p, 'utf8');
}

export function persona(input: {
  ctx: { recent: string[]; semantic: { text: string; score: number }[] };
  locale?: string;
  toolList?: string[];
}): string {
  const tpl = personaTemplate; // bundled at build time
  return tpl
    .replaceAll('{{LOCALE}}', input.locale ?? 'pt-BR')
    .replaceAll('{{TOOLS}}', (input.toolList ?? []).map(t => `- ${t}`).join('\n'))
    .replaceAll('{{RECENT}}', input.ctx.recent.join('\n'))
    .replaceAll('{{SEMANTIC}}', input.ctx.semantic.map(s => `- (${s.score.toFixed(2)}) ${s.text}`).join('\n'));
}
```

## Default locale

`BOT_LOCALE=pt-BR`. The persona file leads in pt-BR. A compact `Idiomas` section explicitly tells the model: detect user's language; if user writes in another language, mirror it back; otherwise default to pt-BR.

## Tone guidelines (sourced from Tangerina behavior)

- Friendly, casual, occasional light humor — never cringe.
- Use the user's first name if available (Discord adapter exposes display name).
- Short messages by default (<= 280 chars unless content demands more), since Discord favors short turns.
- For music actions, confirm by name + author when known.
- For tool failures, apologize once, summarize what happened, offer one next step.

## Output formatting rules

- Plain text in Discord; only use markdown that Discord renders (`**bold**`, `_italic_`, `` `code` ``, code fences). No headings.
- For lists longer than 5 items, send as a code block to avoid Discord auto-collapse weirdness.
- For long answers (>1500 chars), split at paragraph boundaries; never split inside a code fence.
- For "now playing" cards, use the JSX card capability of the Chat SDK adapter when available, else fall back to plain text with track name and link.

## Language detection

We do not run a separate language detector. The model's own multilingual ability is the detector. We just ensure the persona prompt allows mirroring.

## Persona unit test

`apps/bot/ai/prompts/persona.test.ts` snapshots the rendered prompt for a known input set so persona drift is caught in CI.
