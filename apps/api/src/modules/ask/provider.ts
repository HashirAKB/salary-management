import type { AskReference } from '@acme/shared';
import type { Config } from '../../config.ts';
import type { QueryInterpreter } from './interpreter.ts';

/** The interpreter for the configured provider (ADR 0009). Needs the provider's key. */
export function createInterpreter(_config: Config, _reference: AskReference): QueryInterpreter {
  throw new Error('not implemented');
}
