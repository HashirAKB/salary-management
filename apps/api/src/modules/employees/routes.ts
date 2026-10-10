import {
  employeeExportQuerySchema,
  employeeIdParamsSchema,
  employeeListQuerySchema,
  type EmployeeDetail,
  type EmployeeExportQuery,
  type EmployeeListQuery,
  type EmployeeListResponse,
} from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../db/client.ts';
import type { Clock } from '../../domain/clock.ts';
import { requires } from '../../http/guard.ts';
import { exportEmployees, getEmployee, listEmployees } from './service.ts';

// E1 (04 section 5.4).
export function employeeRoutes(app: FastifyInstance, deps: { db: Db; clock: Clock }) {
  app.get(
    '/api/employees',
    { onRequest: requires('employee.read'), schema: { querystring: employeeListQuerySchema } },
    async (request): Promise<EmployeeListResponse> =>
      listEmployees(deps.db, request.query as EmployeeListQuery),
  );

  // E2 (04 section 5.4).
  app.get(
    '/api/employees/:id',
    { onRequest: requires('employee.read'), schema: { params: employeeIdParamsSchema } },
    async (request): Promise<EmployeeDetail> =>
      getEmployee(deps.db, (request.params as { id: number }).id),
  );

  // X1 (04 section 5.7).
  app.get(
    '/api/exports/employees.csv',
    { onRequest: requires('export.employees'), schema: { querystring: employeeExportQuerySchema } },
    async (request, reply) => {
      const csv = await exportEmployees(deps.db, request.query as EmployeeExportQuery);
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="employees-${deps.clock.today()}.csv"`)
        .header('Cache-Control', 'no-store')
        .send(csv);
    },
  );
}
