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

/** The first rule the change breaks, or null when it is allowed. */
export function checkSalaryChange(context: SalaryChangeContext): SalaryRuleCode | null {
  const { today, employee, change } = context;
  if (change.effectiveDate > today) return 'DATE_IN_FUTURE';
  if (change.effectiveDate < employee.salaryEffectiveDate) return 'SALARY_DATE_BEFORE_CURRENT';
  return null;
}
