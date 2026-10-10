import { referenceResponseSchema } from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { loggedInAs } from '../../../test/builders/index.ts';
import { testApp, testDb } from '../../../test/helpers.ts';
import { generateBands, SOFTWARE_ENGINEER } from '../../seed/reference.ts';

describe('GET /api/reference (R1)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function getReference(role: 'hr_admin' | 'hr_viewer' | 'finance' = 'hr_viewer') {
    const db = await testDb();
    const { cookie } = await loggedInAs(db, role);
    app = testApp({ db });
    const response = await app.inject({
      method: 'GET',
      url: '/api/reference',
      headers: { cookie },
    });
    // Check the status first so a failing route reports its status, not a schema error.
    expect(response.statusCode).toBe(200);
    return { response, body: referenceResponseSchema.parse(response.json()) };
  }

  it('returns reference data sorted by name, levels by rank, with the fx as-of date', async () => {
    const { response, body } = await getReference();

    expect(response.statusCode).toBe(200);
    const names = (list: { name: string }[]) => list.map((item) => item.name);
    const sorted = (list: string[]) => [...list].sort();
    expect(body.countries.length).toBeGreaterThan(0);
    expect(names(body.countries)).toEqual(sorted(names(body.countries)));
    expect(names(body.departments)).toEqual(sorted(names(body.departments)));
    expect(names(body.jobTitles)).toEqual(sorted(names(body.jobTitles)));
    expect(body.levels.map((level) => level.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(body.levels[2]).toEqual({ code: 'L3', name: 'Senior', rank: 3 });
    expect(body.fx.asOfDate).toBe('2026-09-30');
  });

  it('gives each country its currency and each job title its department', async () => {
    const { body } = await getReference();

    expect(body.countries).toContainEqual({ code: 'IN', name: 'India', currency: 'INR' });
    const engineer = body.jobTitles.find((title) => title.name === 'Software Engineer');
    const engineering = body.departments.find((department) => department.name === 'Engineering');
    expect(engineer?.departmentId).toBe(engineering?.id);
  });

  it('lists the genders and the four salary change reasons a person can choose', async () => {
    const { body } = await getReference();

    expect(body.genders).toEqual([
      { code: 'female', name: 'Female' },
      { code: 'male', name: 'Male' },
      { code: 'non_binary', name: 'Non-binary' },
      { code: 'not_disclosed', name: 'Not disclosed' },
    ]);
    expect(body.salaryChangeReasons).toEqual([
      { code: 'promotion', name: 'Promotion' },
      { code: 'merit', name: 'Merit increase' },
      { code: 'market_adjustment', name: 'Market adjustment' },
      { code: 'correction', name: 'Correction' },
    ]);
  });

  it('shows each rate as a display string built from the micros, sorted by currency', async () => {
    const { body } = await getReference();

    expect(body.fx.rates).toContainEqual({ currency: 'INR', usdPerUnit: '0.011500' });
    expect(body.fx.rates).toContainEqual({ currency: 'GBP', usdPerUnit: '1.340000' });
    const currencies = body.fx.rates.map((rate) => rate.currency);
    expect(currencies).toEqual([...currencies].sort());
  });

  it.each(['hr_admin', 'hr_viewer', 'finance'] as const)('answers %s with 200', async (role) => {
    const { response } = await getReference(role);

    expect(response.statusCode).toBe(200);
  });
});

describe('GET /api/pay-bands/:countryCode/:jobTitleId/:levelCode (R2)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function getBand(path: string, role: 'hr_admin' | 'hr_viewer' | 'finance' = 'finance') {
    const db = await testDb();
    const { cookie } = await loggedInAs(db, role);
    app = testApp({ db });
    return app.inject({ method: 'GET', url: `/api/pay-bands/${path}`, headers: { cookie } });
  }

  it('returns the pay band for a country, job title and level', async () => {
    const band = generateBands().find(
      (b) => b.countryCode === 'IN' && b.jobTitleId === SOFTWARE_ENGINEER && b.levelCode === 'L3',
    )!;

    const response = await getBand(`IN/${SOFTWARE_ENGINEER}/L3`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      countryCode: 'IN',
      jobTitleId: SOFTWARE_ENGINEER,
      levelCode: 'L3',
      min: { amountMinor: band.minMinor, currency: 'INR' },
      mid: { amountMinor: band.midMinor, currency: 'INR' },
      max: { amountMinor: band.maxMinor, currency: 'INR' },
    });
  });

  it('returns 404 PAY_BAND_NOT_FOUND for a combination with no band and 400 for bad params', async () => {
    const missing = await getBand(`IN/${SOFTWARE_ENGINEER + 1000}/L3`);
    const badTitle = await getBand('IN/abc/L3');
    const badLevel = await getBand(`IN/${SOFTWARE_ENGINEER}/L9`);

    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ code: 'PAY_BAND_NOT_FOUND' });
    expect(badTitle.statusCode).toBe(400);
    expect(badLevel.statusCode).toBe(400);
  });
});
