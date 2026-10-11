import type { CannotAnswerReason, StructuredQuery } from '@acme/shared';

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
}

export type InterpretResult =
  | ({ kind: 'query'; query: StructuredQuery } & Partial<TokenCounts>)
  | ({
      kind: 'cannot_answer';
      reason: CannotAnswerReason;
      suggestion: string;
    } & Partial<TokenCounts>);

export interface InterpretContext {
  // ISO date (YYYY-MM-DD) filled into the system prompt.
  today: string;
}

export interface QueryInterpreter {
  interpret(question: string, context: InterpretContext): Promise<InterpretResult>;
}

// Timeout, API error, refusal, max_tokens, no tool call or a failed parse (04 section 5.8 step 3).
export class InterpreterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InterpreterError';
  }
}
