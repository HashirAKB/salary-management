import type { LevelCode, SalaryChangeReason } from '../db/schema.ts';
import type { Random } from './random.ts';
import { LEVELS } from './reference.ts';

export type HistoryRow = {
  reason: SalaryChangeReason;
  effectiveDate: string;
  amountMinor: number;
  levelCode: LevelCode;
};

export type History = { rows: HistoryRow[] };

export type HistoryInput = {
  levelCode: LevelCode;
  salaryMinor: number;
  currencyCode: string;
  /** REF_DATE for active employees, the termination date for terminated ones (02 section 7.8). */
  endDate: string;
  hireDate: string;
  /** Stale employees get no rows after 2024-09-29 (02 section 7.7). */
  stale: boolean;
};

const EARLIEST_HIRE = '2013-10-01';
const LAST_REVIEW = '2026-04-01';
const STALE_CUTOFF = '2024-09-29';
const DAY_MS = 86_400_000;
const YEAR_DAYS = 365.25;

// 02 section 7.7: tenure buckets in years before the end date.
const TENURE_BUCKETS = [
  { share: 0.3, fromYears: 0, toYears: 2 },
  { share: 0.35, fromYears: 2, toYears: 5 },
  { share: 0.25, fromYears: 5, toYears: 9 },
  { share: 0.1, fromYears: 9, toYears: 13 },
];

const toDays = (date: string) => Date.parse(`${date}T00:00:00.000Z`) / DAY_MS;
const fromDays = (days: number) => new Date(days * DAY_MS).toISOString().slice(0, 10);
export const addDays = (date: string, days: number) => fromDays(toDays(date) + days);
const addMonths = (date: string, months: number) => {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};
const minDate = (a: string, b: string) => (a < b ? a : b);
const pct = (random: Random, from: number, to: number) =>
  Math.round(random.uniform(from, to) * 10) / 10;

/** Salary rounding step in minor units: 100 major units, 1,000 for INR (02 section 7.6 step 4). */
export const roundSalary = (amountMinor: number, currencyCode: string) => {
  const step = (currencyCode === 'INR' ? 1000 : 100) * 100;
  return Math.round(amountMinor / step) * step;
};

/** Hire date by tenure bucket before the end date; terminated employees need 6 months' tenure. */
export function drawHireDate(random: Random, endDate: string, minTenureMonths = 0): string {
  const u = random.next();
  let cumulative = 0;
  const bucket =
    TENURE_BUCKETS.find((b) => (cumulative += b.share) > u) ??
    (TENURE_BUCKETS[TENURE_BUCKETS.length - 1] as (typeof TENURE_BUCKETS)[number]);
  const days = random.int(
    Math.ceil(bucket.fromYears * YEAR_DAYS),
    Math.floor(bucket.toYears * YEAR_DAYS) - 1,
  );
  const hire = minDate(addDays(endDate, -days), addMonths(endDate, -minTenureMonths));
  return hire < EARLIEST_HIRE ? EARLIEST_HIRE : hire;
}

type Change = { reason: Exclude<SalaryChangeReason, 'hire'>; effectiveDate: string; pct: number };

// 02 section 7.7: draw the changes forward in time, then compute amounts backwards from the
// current salary so the last row always equals it.
/** Stale candidates have at least 2.5 years of tenure at the end date (02 section 7.7). */
export const tenureYears = (hireDate: string, endDate: string) =>
  (toDays(endDate) - toDays(hireDate)) / YEAR_DAYS;

export function buildHistory(input: HistoryInput, random: Random): History {
  const { hireDate, stale } = input;
  const tenure = tenureYears(hireDate, input.endDate);
  const rank = LEVELS.find((l) => l.code === input.levelCode)?.rank ?? 1;

  const cutoff = stale ? minDate(STALE_CUTOFF, input.endDate) : input.endDate;
  const firstEligible = addMonths(hireDate, 6);
  const cycles: string[] = [];
  for (let year = 2014; year <= 2026; year++) {
    const cycle = `${year}-04-01`;
    if (cycle >= firstEligible && cycle <= minDate(cutoff, LAST_REVIEW)) cycles.push(cycle);
  }

  const promotionAt =
    rank >= 2 && tenure >= 2 && cycles.length > 0 && random.chance(0.6)
      ? random.int(0, cycles.length - 1)
      : -1;
  const changes: Change[] = [];
  cycles.forEach((cycle, i) => {
    if (i === promotionAt) {
      changes.push({ reason: 'promotion', effectiveDate: cycle, pct: pct(random, 10, 15) });
    } else if (random.chance(0.85)) {
      changes.push({ reason: 'merit', effectiveDate: cycle, pct: pct(random, 2, 6) });
    }
  });
  if (random.chance(0.05)) {
    const day = addDays('2025-06-01', random.int(0, 213));
    if (day > hireDate && day <= cutoff) {
      changes.push({ reason: 'market_adjustment', effectiveDate: day, pct: pct(random, 5, 10) });
    }
  }
  if (random.chance(0.01) && changes.length > 0) {
    const raise = changes[random.int(0, changes.length - 1)] as Change;
    const day = addDays(raise.effectiveDate, 14);
    const sign = random.chance(0.5) ? -1 : 1;
    const change = sign * pct(random, 0.5, 3);
    if (day <= cutoff && !changes.some((c) => c.effectiveDate === day)) {
      changes.push({ reason: 'correction', effectiveDate: day, pct: change });
    }
  }
  changes.sort((a, b) => (a.effectiveDate < b.effectiveDate ? -1 : 1));

  const previousLevel = LEVELS.find((l) => l.rank === rank - 1)?.code ?? input.levelCode;
  const promotionIndex = changes.findIndex((c) => c.reason === 'promotion');
  const amounts = new Array<number>(changes.length + 1);
  amounts[changes.length] = input.salaryMinor;
  for (let k = changes.length; k > 0; k--) {
    const later = amounts[k] as number;
    amounts[k - 1] = roundSalary(
      later / (1 + (changes[k - 1] as Change).pct / 100),
      input.currencyCode,
    );
  }
  // Rows before the promotion carry the level one rank lower; the hire row is row 0.
  const levelAt = (row: number) =>
    promotionIndex >= 0 && row <= promotionIndex ? previousLevel : input.levelCode;
  const rows: HistoryRow[] = [
    {
      reason: 'hire',
      effectiveDate: hireDate,
      amountMinor: amounts[0] as number,
      levelCode: levelAt(0),
    },
    ...changes.map((c, i) => ({
      reason: c.reason,
      effectiveDate: c.effectiveDate,
      amountMinor: amounts[i + 1] as number,
      levelCode: levelAt(i + 1),
    })),
  ];
  return { rows };
}
