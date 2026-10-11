import type { AskResponse } from '@acme/shared';
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../../api/client.ts';

// The response is a discriminated union the API builds itself (04 section 5.8); trust its shape.
const askResponseSchema = { parse: (value: unknown) => value as AskResponse };

/** K1: asks one question. Not cached; the page keeps the visit's answers in memory. */
export const useAsk = () =>
  useMutation({
    mutationFn: (question: string) =>
      apiFetch('/api/ask', { method: 'POST', body: { question }, schema: askResponseSchema }),
  });
