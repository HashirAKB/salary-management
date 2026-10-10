import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Drizzle tables mirroring db/migrations/*.sql (ADR 0003). The SQL is the source of truth for
// constraints; these give typed queries, and schema.test.ts fails if the two drift apart.

export const fxRates = sqliteTable('fx_rates', {
  currencyCode: text('currency_code').primaryKey(),
  usdPerUnitMicros: integer('usd_per_unit_micros').notNull(),
  asOfDate: text('as_of_date').notNull(),
});

export const countries = sqliteTable('countries', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  currencyCode: text('currency_code')
    .notNull()
    .references(() => fxRates.currencyCode),
});

export const departments = sqliteTable('departments', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
});

export const jobTitles = sqliteTable('job_titles', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  departmentId: integer('department_id')
    .notNull()
    .references(() => departments.id),
});

export const levelCodes = ['L1', 'L2', 'L3', 'L4', 'L5'] as const;
export type LevelCode = (typeof levelCodes)[number];

export const levels = sqliteTable('levels', {
  code: text('code', { enum: levelCodes }).primaryKey(),
  name: text('name').notNull(),
  rank: integer('rank').notNull(),
});

export const payBands = sqliteTable(
  'pay_bands',
  {
    countryCode: text('country_code')
      .notNull()
      .references(() => countries.code),
    jobTitleId: integer('job_title_id')
      .notNull()
      .references(() => jobTitles.id),
    levelCode: text('level_code', { enum: levelCodes })
      .notNull()
      .references(() => levels.code),
    currencyCode: text('currency_code')
      .notNull()
      .references(() => fxRates.currencyCode),
    minMinor: integer('min_minor').notNull(),
    midMinor: integer('mid_minor').notNull(),
    maxMinor: integer('max_minor').notNull(),
  },
  (t) => [primaryKey({ columns: [t.countryCode, t.jobTitleId, t.levelCode] })],
);

export const roles = ['hr_admin', 'hr_viewer', 'finance'] as const;
export type Role = (typeof roles)[number];

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role', { enum: roles }).notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),
});

export const genders = ['female', 'male', 'non_binary', 'not_disclosed'] as const;
export type Gender = (typeof genders)[number];

export const employeeStatuses = ['active', 'terminated'] as const;

export const employees = sqliteTable('employees', {
  id: integer('id').primaryKey(),
  employeeCode: text('employee_code').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  nameSearch: text('name_search').notNull(),
  gender: text('gender', { enum: genders }).notNull(),
  countryCode: text('country_code')
    .notNull()
    .references(() => countries.code),
  jobTitleId: integer('job_title_id')
    .notNull()
    .references(() => jobTitles.id),
  levelCode: text('level_code', { enum: levelCodes })
    .notNull()
    .references(() => levels.code),
  hireDate: text('hire_date').notNull(),
  status: text('status', { enum: employeeStatuses }).notNull(),
  terminationDate: text('termination_date'),
  salaryMinor: integer('salary_minor').notNull(),
  salaryCurrency: text('salary_currency')
    .notNull()
    .references(() => fxRates.currencyCode),
  salaryEffectiveDate: text('salary_effective_date').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const salaryChangeReasons = [
  'hire',
  'promotion',
  'merit',
  'market_adjustment',
  'correction',
] as const;
export type SalaryChangeReason = (typeof salaryChangeReasons)[number];

export const salaryChanges = sqliteTable('salary_changes', {
  id: integer('id').primaryKey(),
  employeeId: integer('employee_id')
    .notNull()
    .references(() => employees.id),
  effectiveDate: text('effective_date').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  currencyCode: text('currency_code')
    .notNull()
    .references(() => fxRates.currencyCode),
  jobTitleId: integer('job_title_id')
    .notNull()
    .references(() => jobTitles.id),
  levelCode: text('level_code', { enum: levelCodes })
    .notNull()
    .references(() => levels.code),
  reason: text('reason', { enum: salaryChangeReasons }).notNull(),
  changedByUserId: integer('changed_by_user_id').references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
});

export const askOutcomes = ['answered', 'cannot_answer', 'error', 'rate_limited'] as const;

export const askLog = sqliteTable('ask_log', {
  id: integer('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  askedAt: text('asked_at').notNull(),
  question: text('question').notNull(),
  outcome: text('outcome', { enum: askOutcomes }).notNull(),
  interpretedQuery: text('interpreted_query'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
});
