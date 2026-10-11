import type { AskReference } from '@acme/shared';
import type { InterpretContext, InterpretResult, QueryInterpreter } from './interpreter.ts';

// The slice of the SDK client the interpreter uses, so tests can stub it.
export interface MessagesClient {
  messages: { create(body: unknown, options?: unknown): Promise<unknown> };
}

export class AnthropicInterpreter implements QueryInterpreter {
  constructor(_client: MessagesClient, _options: { model: string; reference: AskReference }) {
    throw new Error('not implemented');
  }

  interpret(_question: string, _context: InterpretContext): Promise<InterpretResult> {
    throw new Error('not implemented');
  }
}
