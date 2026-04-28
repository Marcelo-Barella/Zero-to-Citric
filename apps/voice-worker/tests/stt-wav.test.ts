import { describe, expect, it } from 'vitest';
import { pcmToWav } from '../src/stt/wav.js';

describe('pcmToWav', () => {
  it('wraps PCM with a 44-byte WAV header', () => {
    const pcm = Buffer.alloc(960);
    const wav = pcmToWav(pcm, 48000, 2);
    expect(wav.length).toBe(44 + 960);
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav.subarray(8, 12).toString()).toBe('WAVE');
    expect(wav.readUInt32LE(24)).toBe(48000);
    expect(wav.readUInt16LE(22)).toBe(2);
  });
});
