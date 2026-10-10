import {
  employeeListQuerySchema,
  type EmployeeListQuery,
  type EmployeeListResponse,
} from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../db/client.ts';
import { requires } from '../../http/guard.ts';
import { exportEmployees, listEmployees } from './service.ts';

// E1 (04 section 5.4).
export function employeeRoutes(app: FastifyInstance, deps: { db: Db }) {
  app.get(
    '/api/employees',
    { onRequest: requires('employee.read'), schema: { querystring: employeeListQuerySchema } },
    async (request): Promise<EmployeeListResponse> =>
      listEmployees(deps.db, request.query as EmployeeListQuery),
  );

  // X1 (04 section 5.7).
  app.get(
    '/api/exports/employees.csv',
    { onRequest: requires('export.employees'), schema: { querystring: employeeListQuerySchema } },
    async (request) => exportEmployees(deps.db, request.query as EmployeeListQuery),
  );
}
