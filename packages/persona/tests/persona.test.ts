import { describe, expect, it } from 'vitest';
import { renderPersona, persona } from '../src/index.js';

const TEMPLATE = `Locale: {{LOCALE}}\n\nTools:\n{{TOOLS}}\n\nRecent:\n{{RECENT}}\n\nSemantic:\n{{SEMANTIC}}\n`;

describe('renderPersona', () => {
  it('substitutes all placeholders with provided values', () => {
    const out = renderPersona(TEMPLATE, {
      ctx: {
        recent: ['User: oi\nBot: olá'],
        semantic: [{ text: 'User: meu nome é Marcelo\nBot: prazer Marcelo', score: 0.93 }],
      },
      locale: 'pt-BR',
      toolList: ['SEND_Mensagem', 'WebSearch'],
    });
    expect(out).toContain('Locale: pt-BR');
    expect(out).toContain('- SEND_Mensagem');
    expect(out).toContain('- WebSearch');
    expect(out).toContain('User: oi');
    expect(out).toContain('(0.93)');
  });

  it('renders empty placeholders gracefully', () => {
    const out = renderPersona(TEMPLATE, { ctx: { recent: [], semantic: [] } });
    expect(out).toContain('Locale: pt-BR');
    expect(out).toContain('(sem memória recente)');
    expect(out).toContain('(sem memória de longo prazo relevante)');
    expect(out).toContain('(nenhuma tool registrada nesta interação)');
  });

  it('snapshots the rendered persona for a fixed input', async () => {
    const out = await persona({
      ctx: {
        recent: ['User: e aí\nBot: tudo certo'],
        semantic: [{ text: 'User: gosto de tropicália\nBot: anotado', score: 0.81 }],
      },
      locale: 'pt-BR',
      toolList: ['SEND_Mensagem', 'GET_Canais', 'MusicPlay', 'WebSearch'],
    });
    expect(out).toMatchSnapshot();
  });
});
