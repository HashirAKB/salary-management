import type { CannotAnswerReason, StructuredQuery } from '@acme/shared';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { askApiKey, loadConfig } from '../src/config.ts';
import { createDb } from '../src/db/client.ts';
import { systemClock } from '../src/domain/clock.ts';
import type { InterpretResult } from '../src/modules/ask/interpreter.ts';
import { createInterpreter } from '../src/modules/ask/provider.ts';
import { loadAskReference } from '../src/modules/ask/repo.ts';
import { buildSystemPrompt } from '../src/modules/ask/system-prompt.ts';

// 05 section 6.4: npm run eval. Manual, needs the Ask provider's key (GEMINI_API_KEY or ANTHROPIC_API_KEY), never in CI.

type Expectation =
  { kind: 'query'; query: StructuredQuery } | { kind: 'cannot_answer'; reason: CannotAnswerReason };

interface EvalCase {
  id: string;
  question: string;
  expect: Expectation;
  tests: string;
}

type Actual = Expectation | { kind: 'error'; message: string };

const GEMINI_PAUSE_MS = 7_000;
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

const FILTER_KEYS = ['countries', 'departments', 'jobTitles', 'levels', 'genders'] as const;

/** Enum values lower-cased and filter arrays sorted, so only meaning is compared. */
function normalise(query: StructuredQuery) {
  return {
    metric: query.metric.toLowerCase(),
    groupBy: query.groupBy.toLowerCase(),
    filters: Object.fromEntries(
      FILTER_KEYS.map((key) => [key, query.filters[key].map((v) => v.toLowerCase()).sort()]),
    ),
  };
}

export function score(expected: Expectation, actual: Actual): boolean {
  if (actual.kind === 'error') return false;
  if (expected.kind === 'cannot_answer') {
    return actual.kind === 'cannot_answer' && actual.reason === expected.reason;
  }
  return (
    actual.kind === 'query' &&
    JSON.stringify(normalise(actual.query)) === JSON.stringify(normalise(expected.query))
  );
}

const describe = (result: Actual): string => {
  if (result.kind === 'error') return `error: ${result.message}`;
  if (result.kind === 'cannot_answer') return `cannot_answer (${result.reason})`;
  const { metric, groupBy, filters } = normalise(result.query);
  const used = Object.entries(filters)
    .filter(([, values]) => values.length > 0)
    .map(([key, values]) => `${key} ${values.join('+')}`);
  return [metric, groupBy === 'none' ? 'none' : `groupBy ${groupBy}`, ...used].join(', ');
};

const toActual = (result: InterpretResult): Actual =>
  result.kind === 'query'
    ? { kind: 'query', query: result.query }
    : { kind: 'cannot_answer', reason: result.reason };

export async function runEval(env: Record<string, string | undefined>): Promise<number> {
  const config = loadConfig(env);
  if (!askApiKey(config)) {
    console.error(
      `npm run eval needs ${config.askProvider === 'gemini' ? 'GEMINI_API_KEY' : 'ANTHROPIC_API_KEY'}.`,
    );
    return 1;
  }
  const file = JSON.parse(
    await readFile(resolve(import.meta.dirname, 'ask-eval.json'), 'utf8'),
  ) as { cases: EvalCase[] };

  const db = createDb(config.databaseUrl, config.databaseAuthToken);
  const interpreter = createInterpreter(config, await loadAskReference(db));
  const today = systemClock.today();

  const rows: { id: string; question: string; expected: string; actual: string; pass: boolean }[] =
    [];
  for (const testCase of file.cases) {
    // The Gemini free tier allows only a few requests a minute.
    if (rows.length > 0 && config.askProvider === 'gemini') await sleep(GEMINI_PAUSE_MS);
    let actual: Actual;
    try {
      actual = toActual(await interpreter.interpret(testCase.question, { today }));
    } catch (error) {
      actual = { kind: 'error', message: error instanceof Error ? error.message : String(error) };
    }
    rows.push({
      id: testCase.id,
      question: testCase.question,
      expected: describe(testCase.expect),
      actual: describe(actual),
      pass: score(testCase.expect, actual),
    });
  }

  const passed = rows.filter((r) => r.pass).length;
  console.table(
    rows.map((r) => ({ id: r.id, expected: r.expected, actual: r.actual, pass: r.pass })),
  );
  console.log(`${passed}/${rows.length} passed (bar: 13/${rows.length}).`);

  const promptHash = createHash('sha256')
    .update(buildSystemPrompt('{{today}}'))
    .digest('hex')
    .slice(0, 12);
  const failures = rows.filter((r) => !r.pass);
  const report = [
    `# Ask eval ${today}`,
    '',
    `- Provider: ${config.askProvider}`,
    `- Model: ${config.askModel}`,
    `- Prompt hash: ${promptHash}`,
    `- Total: ${passed}/${rows.length} (bar: 13/${rows.length})`,
    '',
    '| Case | Question | Expected | Actual | Result |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(
      (r) =>
        `| ${r.id} | ${r.question} | ${r.expected} | ${r.actual.replaceAll('|', '/')} | ${r.pass ? 'pass' : 'fail'} |`,
    ),
    '',
    '## Failures',
    '',
    ...(failures.length === 0
      ? ['None.']
      : failures.map((r) => `- ${r.id}: cause (prompt, schema or expectation): TODO`)),
    '',
  ].join('\n');
  const path = resolve(import.meta.dirname, `../../../docs/evals/ask-eval-${today}.md`);
  await writeFile(path, report);
  console.log(`Report written to ${path}`);
  return 0;
}

if (import.meta.main) {
  process.exitCode = await runEval(process.env);
}
