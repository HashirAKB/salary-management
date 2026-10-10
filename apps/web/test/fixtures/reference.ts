import { referenceResponseSchema, type ReferenceResponse } from '@acme/shared';

// Fixture builders parse with the shared response schema (D-050).
export const aReferenceResponse = (overrides: Partial<ReferenceResponse> = {}): ReferenceResponse =>
  referenceResponseSchema.parse({
    countries: [
      { code: 'IN', name: 'India', currency: 'INR' },
      { code: 'US', name: 'United States', currency: 'USD' },
      { code: 'DE', name: 'Germany', currency: 'EUR' },
    ],
    departments: [
      { id: 1, name: 'Engineering' },
      { id: 2, name: 'Design' },
    ],
    jobTitles: [
      { id: 1, name: 'Software Engineer', departmentId: 1 },
      { id: 2, name: 'Data Engineer', departmentId: 1 },
      { id: 3, name: 'Product Designer', departmentId: 2 },
    ],
    levels: [
      { code: 'L2', name: 'Mid', rank: 2 },
      { code: 'L3', name: 'Senior', rank: 3 },
      { code: 'L4', name: 'Staff', rank: 4 },
    ],
    genders: [
      { code: 'female', name: 'Female' },
      { code: 'male', name: 'Male' },
      { code: 'non_binary', name: 'Non-binary' },
      { code: 'not_disclosed', name: 'Not disclosed' },
    ],
    salaryChangeReasons: [{ code: 'merit', name: 'Merit' }],
    fx: { asOfDate: '2026-09-30', rates: [{ currency: 'INR', usdPerUnit: '0.011500' }] },
    ...overrides,
  });
