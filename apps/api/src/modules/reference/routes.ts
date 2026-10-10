import type { ReferenceResponse } from '@acme/shared';
import { asc } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../db/client.ts';
import { countries, departments, fxRates, jobTitles, levels } from '../../db/schema.ts';
import { GENDERS } from '../../domain/genders.ts';
import { requires } from '../../http/guard.ts';
import { fxAsOf } from '../auth/sessions.ts';

// Static in v1 (04 section 5.3). `hire` is written by the system, so it is not a UI reason.
const SALARY_CHANGE_REASONS = [
  { code: 'promotion', name: 'Promotion' },
  { code: 'merit', name: 'Merit increase' },
  { code: 'market_adjustment', name: 'Market adjustment' },
  { code: 'correction', name: 'Correction' },
];

// 11_500 micros is "0.011500"; integer arithmetic, display only.
const microsToDisplay = (micros: number) =>
  `${Math.floor(micros / 1_000_000)}.${String(micros % 1_000_000).padStart(6, '0')}`;

// R1 (04 section 5.3).
export function referenceRoutes(app: FastifyInstance, deps: { db: Db }) {
  app.get(
    '/api/reference',
    { onRequest: requires('reference.read') },
    async (): Promise<ReferenceResponse> => {
      const { db } = deps;
      const [countryRows, departmentRows, jobTitleRows, levelRows, rateRows] = await Promise.all([
        db.select().from(countries).orderBy(asc(countries.name)),
        db.select().from(departments).orderBy(asc(departments.name)),
        db.select().from(jobTitles).orderBy(asc(jobTitles.name)),
        db.select().from(levels).orderBy(asc(levels.rank)),
        db.select().from(fxRates).orderBy(asc(fxRates.currencyCode)),
      ]);
      return {
        countries: countryRows.map((c) => ({
          code: c.code,
          name: c.name,
          currency: c.currencyCode,
        })),
        departments: departmentRows,
        jobTitles: jobTitleRows,
        levels: levelRows,
        genders: GENDERS,
        salaryChangeReasons: SALARY_CHANGE_REASONS,
        fx: {
          asOfDate: await fxAsOf(db),
          rates: rateRows.map((r) => ({
            currency: r.currencyCode,
            usdPerUnit: microsToDisplay(r.usdPerUnitMicros),
          })),
        },
      };
    },
  );
}
