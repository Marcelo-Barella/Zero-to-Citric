import { describe, expect, it } from 'vitest';
import { matchesWakeWord } from '../src/wakeword.js';

describe('matchesWakeWord', () => {
  const wake = 'tangerina';

  it('matches lowercase substring', () => {
    expect(matchesWakeWord('tangerina, toca tropicalia', wake)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesWakeWord('Tangerina, abre o canal', wake)).toBe(true);
    expect(matchesWakeWord('TANGERINA?', wake)).toBe(true);
  });

  it('strips accents', () => {
    expect(matchesWakeWord('tangerína toca!', wake)).toBe(true);
  });

  it('rejects partial words', () => {
    expect(matchesWakeWord('tang', wake)).toBe(false);
    expect(matchesWakeWord('tangerinas', wake)).toBe(false);
  });

  it('rejects empty inputs', () => {
    expect(matchesWakeWord('', wake)).toBe(false);
    expect(matchesWakeWord('hello', '')).toBe(false);
  });
});
