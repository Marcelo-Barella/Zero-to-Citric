import { describe, expect, it } from 'vitest';
import { toolNames, toolInputSchemas } from '../src/index.js';

describe('tools-contract', () => {
  it('exposes exactly 16 tool names', () => {
    expect(toolNames.length).toBe(16);
  });

  it('has an input schema for every tool name', () => {
    for (const name of toolNames) {
      expect(toolInputSchemas[name]).toBeDefined();
    }
  });
});
