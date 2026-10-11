import type { AskReference } from '@acme/shared';
import type { InterpretContext, InterpretResult, QueryInterpreter } from './interpreter.ts';

// The slice of `fetch` the interpreter uses, so tests can stub it.
export type FetchFn = (
  url: string,
  init: Record<string, unknown>,
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

// ADR 0009: Gemini over its REST API, same contract as the Anthropic interpreter.
export class GeminiInterpreter implements QueryInterpreter {
  constructor(
    _fetchFn: FetchFn,
    _options: { apiKey: string; model: string; reference: AskReference },
  ) {}

  async interpret(_question: string, _context: InterpretContext): Promise<InterpretResult> {
    throw new Error('not implemented');
  }
}
