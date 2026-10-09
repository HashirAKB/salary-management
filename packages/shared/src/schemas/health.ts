import { z } from 'zod';

export type HealthResponse = { status: 'ok' };

export const healthResponseSchema = z.custom<HealthResponse>(() => {
  throw new Error('not implemented');
});
