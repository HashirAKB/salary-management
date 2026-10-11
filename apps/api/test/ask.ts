import { readFileSync } from 'node:fs';
import type { CannotAnswerReason, StructuredQuery } from '@acme/shared';
import { FakeInterpreter } from '../src/modules/ask/fake-interpreter.ts';
import type { InterpretResult } from '../src/modules/ask/interpreter.ts';

type EvalCase = {
  id: string;
  question: string;
  expect:
    | { kind: 'query'; query: StructuredQuery }
    | { kind: 'cannot_answer'; reason: CannotAnswerReason };
};

const TOKENS = { inputTokens: 100, outputTokens: 20 };

export const evalCases: EvalCase[] = (
  JSON.parse(readFileSync(new URL('../evals/ask-eval.json', import.meta.url), 'utf8')) as {
    cases: EvalCase[];
  }
).cases;

export const questionOf = (id: string): string => evalCases.find((c) => c.id === id)!.question;

// 05 section 6.1: the fake's map comes from the eval file, plus any extra entries a test adds.
export function fakeInterpreter(
  extra: [string, InterpretResult][] = [],
  options: { throws?: boolean } = {},
) {
  const entries: [string, InterpretResult][] = evalCases.map((c) => [
    c.question,
    c.expect.kind === 'query'
      ? { kind: 'query', query: c.expect.query, ...TOKENS }
      : {
          kind: 'cannot_answer',
          reason: c.expect.reason,
          suggestion: 'What is the median salary in India?',
          ...TOKENS,
        },
  ]);
  return new FakeInterpreter(new Map([...entries, ...extra]), options);
}
