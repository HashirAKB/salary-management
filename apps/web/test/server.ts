import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { aReferenceResponse } from './fixtures/reference.ts';

// Tests add handlers with server.use(...); anything unhandled fails the test (D-051). Reference
// data is the one default: every list page reads it for its filter options.
export const server = setupServer(
  http.get('/api/reference', () => HttpResponse.json(aReferenceResponse())),
);
