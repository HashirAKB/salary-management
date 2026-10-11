import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { aReferenceResponse } from './fixtures/reference.ts';
import { aSalaryHistory } from './fixtures/salary.ts';

// Tests add handlers with server.use(...); anything unhandled fails the test (D-051). Reference
// data is the default for list pages (filter options); an empty history is the default for the
// detail page, whose tests that care about history serve their own.
export const server = setupServer(
  http.get('/api/reference', () => HttpResponse.json(aReferenceResponse())),
  http.get('/api/employees/:id/salary-changes', () => HttpResponse.json(aSalaryHistory([]))),
);
