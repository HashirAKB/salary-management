import Anthropic from '@anthropic-ai/sdk';
import type { AskReference } from '@acme/shared';
import { askApiKey, type Config } from '../../config.ts';
import { AnthropicInterpreter } from './anthropic-interpreter.ts';
import { GeminiInterpreter } from './gemini-interpreter.ts';
import type { QueryInterpreter } from './interpreter.ts';

/** The interpreter for the configured provider (ADR 0009). Needs the provider's key. */
export function createInterpreter(config: Config, reference: AskReference): QueryInterpreter {
  const apiKey = askApiKey(config);
  if (!apiKey) throw new Error(`No API key for the ${config.askProvider} provider`);
  const options = { model: config.askModel, reference };
  if (config.askProvider === 'gemini') {
    return new GeminiInterpreter(fetch, { ...options, apiKey });
  }
  return new AnthropicInterpreter(
    new Anthropic({ apiKey, maxRetries: 0, timeout: 15_000 }),
    options,
  );
}
