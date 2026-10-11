import type {
  AskGroupBy,
  AskMetric,
  AskReference,
  CannotAnswerReason,
  StructuredQuery,
} from '@acme/shared';
import type { GroupResult, PayStats } from '../../domain/pay-query.ts';

export const ANSWER_EXAMPLES = [
  'How does total payroll split by country?',
  'How many people are paid outside their band in the US?',
  'What is the gender pay gap for Account Executives by level?',
];

const METRIC_PHRASE: Record<AskMetric, string> = {
  headcount: 'Headcount',
  total: 'Total annual payroll',
  average: 'Average salary',
  median: 'Median salary',
  p25: '25th percentile salary',
  p75: '75th percentile salary',
  min: 'Lowest salary',
  max: 'Highest salary',
  outsideBandCount: 'Employees paid outside their band',
  genderGap: 'Gender pay gap',
};

const GROUP_PHRASE: Record<AskGroupBy, string> = {
  none: '',
  country: ' by country',
  department: ' by department',
  jobTitle: ' by job title',
  level: ' by level',
  gender: ' by gender',
};

const GROUP_LABEL: Record<AskGroupBy, string> = {
  none: 'Nothing',
  country: 'Country',
  department: 'Department',
  jobTitle: 'Job title',
  level: 'Level',
  gender: 'Gender',
};

const REASON_MESSAGE: Record<CannotAnswerReason, string> = {
  individual:
    'Ask about pay answers questions about groups, not individual people. Use the employee list to look someone up.',
  trend: 'Ask about pay only knows current salaries, not changes over time.',
  edit: "Ask about pay can't change data. Use the employee pages to make changes.",
  multiple: 'Ask about pay answers one figure at a time. Try asking for one.',
  unsupported: 'Ask about pay covers annual base salary only (no bonuses, equity, tax or net pay).',
  unclear: "I couldn't turn that into a pay question. Try one of the examples below.",
  offTopic: "I couldn't turn that into a pay question. Try one of the examples below.",
};

const MONEY_STATS = ['total', 'average', 'median', 'p25', 'p75', 'min', 'max'] as const;

type Filters = StructuredQuery['filters'];

function nameOf<T extends { name: string }>(
  items: readonly T[],
  match: (item: T) => boolean,
  fallback: string,
) {
  return items.find(match)?.name ?? fallback;
}

// Display labels per filter, in the order scope text lists them.
function filterLabels(filters: Filters, reference: AskReference) {
  return {
    country: filters.countries.map((c) => nameOf(reference.countries, (x) => x.code === c, c)),
    department: filters.departments,
    jobTitle: filters.jobTitles,
    level: filters.levels.map((code) => {
      const name = reference.levels.find((l) => l.code === code)?.name;
      return name ? `${code} ${name}` : code;
    }),
    gender: filters.genders.map((g) => nameOf(reference.genders, (x) => x.code === g, g)),
  };
}

export function describeScope(filters: Filters, reference: AskReference): string {
  const labels = filterLabels(filters, reference);
  const parts = [labels.jobTitle, labels.level, labels.department, labels.gender, labels.country]
    .filter((values) => values.length > 0)
    .map((values) => values.join(' or '));
  return parts.length > 0 ? parts.join(', ') : 'all active employees';
}

// 04 section 8.4: code currency format, lakh grouping for INR, no fraction digits.
function formatMoney(amountMinor: number, currency: string): string {
  const formatter = new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    maximumFractionDigits: 0,
  });
  return formatter.format(amountMinor / 100).replace(/\s/g, ' ');
}

function gapText(group: GroupResult, likeForLike: boolean): string {
  const pct = group.gap?.gapPct ?? 0;
  const size = Math.abs(pct).toFixed(1);
  const core =
    pct === 0
      ? 'no measurable gap (0.0%)'
      : `women paid ${size}% ${pct > 0 ? 'less' : 'more'} than men`;
  const suffix = likeForLike
    ? ' (like-for-like)'
    : ' (unadjusted: mixes roles and levels; see Pay equity for like-for-like cohorts)';
  return core + suffix;
}

// 04 section 7.6: exactly one country, one title and one level, ungrouped.
export function isLikeForLike(query: StructuredQuery): boolean {
  const { filters } = query;
  return (
    query.groupBy === 'none' &&
    filters.countries.length === 1 &&
    filters.jobTitles.length === 1 &&
    filters.levels.length === 1
  );
}

function valueText(query: StructuredQuery, group: GroupResult): string {
  const { metric } = query;
  if (metric === 'headcount') return String(group.headcount ?? 0);
  if (metric === 'outsideBandCount') {
    const band = group.outsideBand ?? { below: 0, above: 0, total: 0 };
    return `${band.total} (${band.below} below, ${band.above} above)`;
  }
  if (metric === 'genderGap') {
    return gapText(group, isLikeForLike(query));
  }
  const key = metric as keyof PayStats;
  const usd = formatMoney(group.usd?.[key] ?? 0, 'USD');
  const local = group.local?.[key];
  if (group.currency && local !== undefined && group.currency !== 'USD') {
    return `${formatMoney(local, group.currency)} (${usd})`;
  }
  return usd;
}

export function buildSentence(
  query: StructuredQuery,
  groups: readonly GroupResult[],
  reference: AskReference,
): string {
  const scope = describeScope(query.filters, reference);
  const [group] = groups;
  if (!group) return `No active employees match ${scope}.`;

  const grouped = query.groupBy !== 'none';
  const header = `${METRIC_PHRASE[query.metric]}${GROUP_PHRASE[query.groupBy]} for ${scope}`;
  if (grouped) return `${header}:`;

  if (group.suppressed) {
    return 'Some figures are hidden to protect groups of fewer than 5 employees.';
  }
  if (query.metric === 'genderGap' && !group.gap?.comparable) {
    return `Too few women or men in ${scope} to compare (at least 5 of each needed).`;
  }
  const isMoney = (MONEY_STATS as readonly string[]).includes(query.metric);
  const base =
    isMoney || query.metric === 'outsideBandCount'
      ? `, based on ${group.headcount ?? 0} active employees`
      : '';
  return `${header}: ${valueText(query, group)}${base}.`;
}

export function interpretationList(
  query: StructuredQuery,
  reference: AskReference,
): { label: string; value: string }[] {
  const labels = filterLabels(query.filters, reference);
  const filterRows = (
    [
      ['Country', labels.country],
      ['Department', labels.department],
      ['Job title', labels.jobTitle],
      ['Level', labels.level],
      ['Gender', labels.gender],
    ] as const
  )
    .filter(([, values]) => values.length > 0)
    .map(([label, values]) => ({ label, value: values.join(' or ') }));
  return [
    { label: 'Metric', value: METRIC_PHRASE[query.metric] },
    { label: 'Grouped by', value: GROUP_LABEL[query.groupBy] },
    ...filterRows,
  ];
}

export function reasonMessage(reason: CannotAnswerReason, rule?: 'genderGap'): string {
  if (reason === 'unsupported' && rule === 'genderGap') {
    return "The gender gap can't be filtered or grouped by gender.";
  }
  return REASON_MESSAGE[reason];
}

export function genderRuleSuggestion(query: StructuredQuery, reference: AskReference): string {
  const scope = describeScope({ ...query.filters, genders: [] }, reference);
  return `What is the gender pay gap for ${scope}?`;
}
