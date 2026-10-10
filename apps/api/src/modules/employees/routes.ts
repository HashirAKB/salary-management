import {
  employeeListQuerySchema,
  type EmployeeListQuery,
  type EmployeeListResponse,
} from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../db/client.ts';
import { requires } from '../../http/guard.ts';
import { listEmployees } from './service.ts';

// E1 (04 section 5.4).
export function employeeRoutes(app: FastifyInstance, deps: { db: Db }) {
  app.get(
    '/api/employees',
    { onRequest: requires('employee.read'), schema: { querystring: employeeListQuerySchema } },
    async (request): Promise<EmployeeListResponse> =>
      listEmployees(deps.db, request.query as EmployeeListQuery),
  );
}
