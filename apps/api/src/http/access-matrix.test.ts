import type { Role } from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { aSessionFor, aUser } from '../../test/builders/index.ts';
import { testApp, testDb } from '../../test/helpers.ts';
import { can } from '../domain/permissions.ts';
import type { RouteAccess } from './guard.ts';
import { routeCatalog, type CatalogEntry } from './route-catalog.ts';

// D-054: every route and what it needs. A new route fails the last test until it gets a row here.
const EXPECTED_ACCESS: Record<string, RouteAccess> = {
  'GET /api/health': 'public',
  'POST /api/auth/login': 'public',
  'POST /api/auth/logout': 'public',
  'GET /api/auth/me': 'authenticated',
  'GET /api/reference': 'reference.read',
  'GET /api/pay-bands/:countryCode/:jobTitleId/:levelCode': 'reference.read',
  'GET /api/employees': 'employee.read',
  'GET /api/employees/:id': 'employee.read',
  'POST /api/employees': 'employee.write',
  'PATCH /api/employees/:id': 'employee.write',
  'POST /api/employees/:id/termination': 'employee.write',
  'GET /api/employees/:id/salary-changes': 'salary.read',
  'POST /api/employees/:id/salary-changes': 'salary.write',
  'GET /api/exports/employees.csv': 'export.employees',
  'GET /api/insights/summary': 'insights.read',
};

const ROLES: Role[] = ['hr_admin', 'hr_viewer', 'finance'];
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const key = (entry: CatalogEntry) => `${entry.method} ${entry.url}`;
// Path parameters get a sample value; the guard runs before any lookup.
const sampleUrl = (url: string) => url.replace(/:[A-Za-z]+/g, '1');

function call(app: FastifyInstance, entry: CatalogEntry, cookie?: string, payload: object = {}) {
  return app.inject({
    method: entry.method as 'GET' | 'POST',
    url: sampleUrl(entry.url),
    headers: cookie ? { cookie } : {},
    ...(WRITE_METHODS.has(entry.method) ? { payload } : {}),
  });
}

const deniedTo = (role: Role, access: RouteAccess | undefined) =>
  access !== undefined && access !== 'public' && access !== 'authenticated' && !can(role, access);

describe('access matrix (D-054)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  // Each call gets its own session, so a route that ends one (logout) can't affect the next call.
  async function appWithRoles() {
    const db = await testDb();
    const userIds = {} as Record<Role, number>;
    for (const role of ROLES) userIds[role] = (await aUser(role).insert(db)).id;
    app = testApp({ db });
    await app.ready();
    const sessionAs = (role: Role) => aSessionFor(db, userIds[role]);
    return { app, sessionAs };
  }

  it('every route, called logged out, returns 401 except the public ones', async () => {
    const { app } = await appWithRoles();

    for (const entry of routeCatalog(app)) {
      const response = await call(app, entry);
      const isPublic = EXPECTED_ACCESS[key(entry)] === 'public';
      expect({ route: key(entry), unauthorized: response.statusCode === 401 }).toEqual({
        route: key(entry),
        unauthorized: !isPublic,
      });
    }
  });

  it('every route, called as each role, returns 403 exactly when 04 section 4.5 says the role lacks the action', async () => {
    const { app, sessionAs } = await appWithRoles();

    for (const entry of routeCatalog(app)) {
      for (const role of ROLES) {
        const response = await call(app, entry, await sessionAs(role));
        expect({ route: key(entry), role, status: response.statusCode }).toEqual({
          route: key(entry),
          role,
          status: deniedTo(role, EXPECTED_ACCESS[key(entry)])
            ? 403
            : expect.not.toBeOneOf([401, 403]),
        });
      }
    }
  });

  // No write route Finance may not use exists until S5; the guard test covers the rule meanwhile.
  it('Finance gets 403, not 400, on every write route it may not use', async () => {
    const { app, sessionAs } = await appWithRoles();
    const writes = routeCatalog(app).filter(
      (entry) => WRITE_METHODS.has(entry.method) && deniedTo('finance', entry.access),
    );

    for (const entry of writes) {
      const response = await call(app, entry, await sessionAs('finance'), { unknownField: '' });
      expect({ route: key(entry), status: response.statusCode }).toEqual({
        route: key(entry),
        status: 403,
      });
    }
  });

  it('every registered route appears in the expected-access table', async () => {
    const { app } = await appWithRoles();

    const registered = Object.fromEntries(
      routeCatalog(app).map((entry) => [key(entry), entry.access]),
    );

    expect(registered).toEqual(EXPECTED_ACCESS);
  });
});
