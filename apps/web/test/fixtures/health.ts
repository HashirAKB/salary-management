import { healthResponseSchema, type HealthResponse } from '@acme/shared';

// Fixture builders parse with the shared response schema (D-050).
export const aHealthResponse = (overrides: Partial<HealthResponse> = {}): HealthResponse =>
  healthResponseSchema.parse({ status: 'ok', ...overrides });
