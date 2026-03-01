import { describe, it, expect } from 'vitest';
import { LLMProvider } from '../../src/types';

const { LLMProviders } = require('../providerConstants.cjs');

describe('providerConstants parity with LLMProvider enum', () => {
  it('should have matching keys', () => {
    const enumKeys = Object.keys(LLMProvider).sort();
    const cjsKeys = Object.keys(LLMProviders).sort();
    expect(cjsKeys).toEqual(enumKeys);
  });

  it('should have matching values for every key', () => {
    for (const key of Object.keys(LLMProvider)) {
      expect(LLMProviders[key]).toBe(LLMProvider[key as keyof typeof LLMProvider]);
    }
  });
});
