import type { Money, SalaryChangeReason } from '@acme/shared';

// 04 section 5.5 S2: the 422 codes, checked in this order; the first violation wins.
export type SalaryRuleCode =
  | 'EMPLOYEE_TERMINATED'
  | 'DATE_IN_FUTURE'
  | 'SALARY_DATE_BEFORE_CURRENT'
  | 'SALARY_CURRENCY_MISMATCH'
  | 'RAISE_REQUIRED'
  | 'POSITION_MUST_NOT_CHANGE'
  | 'PROMOTION_LEVEL_NOT_HIGHER'
  | 'CORRECTION_NO_CHANGE'
  | 'NO_PAY_BAND';

export interface SalaryChangeContext {
  /** Today's date from the clock, YYYY-MM-DD. */
  today: string;
  employee: {
    status: 'active' | 'terminated';
    salary: Money;
    salaryEffectiveDate: string;
    jobTitleId: number;
    levelRank: number;
  };
  change: {
    reason: SalaryChangeReason;
    effectiveDate: string;
    amount: Money;
    jobTitleId: number;
    levelRank: number;
  };
  /** Whether the new position has a pay band in the employee's country. */
  hasPayBand: boolean;
}

type ReasonRule = (context: SalaryChangeContext) => SalaryRuleCode | null;

const requireRaise: ReasonRule = ({ employee, change }) =>
  change.amount.amountMinor > employee.salary.amountMinor ? null : 'RAISE_REQUIRED';

const keepPosition: ReasonRule = ({ employee, change }) =>
  change.jobTitleId === employee.jobTitleId && change.levelRank === employee.levelRank
    ? null
    : 'POSITION_MUST_NOT_CHANGE';

const requireHigherLevel: ReasonRule = ({ employee, change }) =>
  change.levelRank > employee.levelRank ? null : 'PROMOTION_LEVEL_NOT_HIGHER';

const requireSomeChange: ReasonRule = ({ employee, change }) =>
  change.amount.amountMinor !== employee.salary.amountMinor ||
  change.jobTitleId !== employee.jobTitleId ||
  change.levelRank !== employee.levelRank
    ? null
    : 'CORRECTION_NO_CHANGE';

// D-022: the rules of each reason, in the order they are reported.
const REASON_RULES: Record<SalaryChangeReason, readonly ReasonRule[]> = {
  merit: [requireRaise, keepPosition],
  market_adjustment: [requireRaise, keepPosition],
  promotion: [requireRaise, requireHigherLevel],
  correction: [requireSomeChange],
};

/** The first rule the change breaks, or null when it is allowed. */
export function checkSalaryChange(context: SalaryChangeContext): SalaryRuleCode | null {
  const { today, employee, change } = context;
  if (employee.status === 'terminated') return 'EMPLOYEE_TERMINATED';
  if (change.effectiveDate > today) return 'DATE_IN_FUTURE';
  if (change.effectiveDate < employee.salaryEffectiveDate) return 'SALARY_DATE_BEFORE_CURRENT';
  if (change.amount.currency !== employee.salary.currency) return 'SALARY_CURRENCY_MISMATCH';
  for (const rule of REASON_RULES[change.reason]) {
    const code = rule(context);
    if (code) return code;
  }
  if (!context.hasPayBand) return 'NO_PAY_BAND';
  return null;
}
