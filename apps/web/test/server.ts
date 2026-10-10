import { setupServer } from 'msw/node';

// Tests add handlers with server.use(...); anything unhandled fails the test (D-051).
export const server = setupServer();
