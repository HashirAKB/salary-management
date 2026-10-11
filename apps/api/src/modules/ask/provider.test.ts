import type { AskReference } from '@acme/shared';
import { describe, expect, it } from 'vitest';
import { testConfig } from '../../../test/helpers.ts';
import { AnthropicInterpreter } from './anthropic-interpreter.ts';
import { GeminiInterpreter } from './gemini-interpreter.ts';
import { createInterpreter } from './provider.ts';

const reference: AskReference = {
  countries: [{ code: 'IN', name: 'India' }],
  departments: [{ id: 1, name: 'Engineering' }],
  jobTitles: [{ id: 10, name: 'Software Engineer' }],
  levels: [{ code: 'L3', name: 'Senior' }],
  genders: [{ code: 'female', name: 'Female' }],
};

describe('createInterpreter (ADR 0009)', () => {
  it('builds the interpreter for the configured provider', () => {
    const gemini = createInterpreter(
      { ...testConfig, askProvider: 'gemini', geminiApiKey: 'g-key', askModel: 'gemini-x' },
      reference,
    );
    expect(gemini).toBeInstanceOf(GeminiInterpreter);

    const anthropic = createInterpreter(
      { ...testConfig, askProvider: 'anthropic', anthropicApiKey: 'a-key' },
      reference,
    );
    expect(anthropic).toBeInstanceOf(AnthropicInterpreter);
  });

  it('refuses to build one without the provider key', () => {
    expect(() =>
      createInterpreter(
        { ...testConfig, askProvider: 'gemini', geminiApiKey: undefined },
        reference,
      ),
    ).toThrow();
  });
});
