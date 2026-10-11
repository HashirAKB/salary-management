import type { AskAnswerResponse, AskResponse, AskRowValue, StructuredQuery } from '@acme/shared';
import type { Config } from '../../config.ts';
import type { Db } from '../../db/client.ts';
import type { Clock } from '../../domain/clock.ts';
import { aggregateMinGroupSize } from '../../domain/permissions.ts';
import {
  aggregatePay,
  type GroupResult,
  type Metric,
  type PayStats,
} from '../../domain/pay-query.ts';
import { AppError } from '../../http/problem.ts';
import { fxAsOf } from '../auth/sessions.ts';
import type { Viewer } from '../auth/plugin.ts';
import { loadActivePayRows, loadGroupLabels } from '../insights/repo.ts';
import {
  ANSWER_EXAMPLES,
  buildSentence,
  genderRuleSuggestion,
  interpretationList,
  isLikeForLike,
  reasonMessage,
} from './answer.ts';
import { checkQuery } from './interpret.ts';
import type { InterpretResult, QueryInterpreter } from './interpreter.ts';
import { insertAskLog, loadAskReference } from './repo.ts';

const MONEY_METRICS = ['total', 'average', 'median', 'p25', 'p75', 'min', 'max'] as const;
const MAX_SUGGESTION_LENGTH = 200;
const UPSTREAM_FAILED = "Couldn't read that question right now. Try again, or rephrase it.";

export interface AskDeps {
  db: Db;
  clock: Clock;
  config: Config;
  getInterpreter: () => Promise<QueryInterpreter>;
}

function rowValue(query: StructuredQuery, group: GroupResult): AskRowValue | null {
  if (group.suppressed) return null;
  const { metric } = query;
  if (metric === 'headcount') return { type: 'count', count: group.headcount ?? 0 };
  if (metric === 'outsideBandCount') {
    const band = group.outsideBand ?? { below: 0, above: 0, total: 0 };
    return { type: 'outsideBand', ...band };
  }
  if (metric === 'genderGap') {
    const gap = group.gap;
    return {
      type: 'gap',
      comparable: gap?.comparable ?? false,
      gapPct: gap?.gapPct ?? null,
      women: gap?.women ?? null,
      men: gap?.men ?? null,
      likeForLike: isLikeForLike(query),
    };
  }
  const key = metric as keyof PayStats;
  return {
    type: 'money',
    usd: { amountMinor: group.usd?.[key] ?? 0, currency: 'USD' },
    local:
      group.local && group.currency
        ? { amountMinor: group.local[key] ?? 0, currency: group.currency }
        : null,
  };
}

// 04 section 5.8: the flow after the key and cap checks.
export async function askQuestion(
  deps: AskDeps,
  viewer: Viewer,
  question: string,
): Promise<AskResponse> {
  const { db, clock, config } = deps;
  const askedAt = clock.now().toISOString();
  const usage = { usedToday: 1, dailyLimit: config.askUserDailyLimit };
  const log = (outcome: 'answered' | 'cannot_answer' | 'error', result?: InterpretResult) =>
    insertAskLog(db, {
      userId: viewer.id,
      askedAt,
      question,
      outcome,
      interpretedQuery:
        outcome === 'answered' && result?.kind === 'query' ? JSON.stringify(result.query) : null,
      inputTokens: result?.inputTokens ?? null,
      outputTokens: result?.outputTokens ?? null,
    });

  let result: InterpretResult;
  try {
    const interpreter = await deps.getInterpreter();
    result = await interpreter.interpret(question, { today: clock.today() });
  } catch {
    await log('error');
    throw new AppError(503, 'ASK_UPSTREAM_FAILED', UPSTREAM_FAILED);
  }

  const reference = await loadAskReference(db);
  const cannotAnswer = async (
    reason: Extract<InterpretResult, { kind: 'cannot_answer' }>['reason'],
    suggestion: string,
    rule?: 'genderGap',
  ): Promise<AskResponse> => {
    await log('cannot_answer', result);
    return {
      kind: 'cannot_answer',
      question,
      reason,
      message: reasonMessage(reason, rule),
      suggestion: suggestion.slice(0, MAX_SUGGESTION_LENGTH),
      examples: ANSWER_EXAMPLES,
      usage,
    };
  };

  if (result.kind === 'cannot_answer') return cannotAnswer(result.reason, result.suggestion);

  const checked = checkQuery(result.query, reference);
  if (checked.kind === 'cannot_answer') {
    return cannotAnswer(
      checked.reason,
      genderRuleSuggestion(result.query, reference),
      checked.rule,
    );
  }

  const { query, filters } = checked;
  const metrics: Metric[] = (MONEY_METRICS as readonly string[]).includes(query.metric)
    ? [query.metric, 'headcount']
    : [query.metric];
  const [rows, labels, asOf] = await Promise.all([
    loadActivePayRows(db, filters),
    query.groupBy === 'none' ? Promise.resolve({}) : loadGroupLabels(db, query.groupBy),
    fxAsOf(db),
  ]);
  const groups = aggregatePay(
    rows,
    metrics,
    query.groupBy,
    aggregateMinGroupSize(viewer.role),
    labels,
  );
  await log('answered', result);

  const response: AskAnswerResponse = {
    kind: 'answer',
    question,
    answer: buildSentence(query, groups, reference),
    interpretedQuery: query,
    interpretation: interpretationList(query, reference),
    result: {
      groupBy: query.groupBy,
      rows: groups.map((group) => ({
        key: group.key,
        label: query.groupBy === 'none' ? 'All matching employees' : group.label,
        headcount: group.headcount,
        suppressed: group.suppressed,
        value: rowValue(query, group),
      })),
    },
    fxAsOf: asOf,
    usage,
  };
  return response;
}
