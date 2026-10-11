import {
  employeeIdParamsSchema,
  salaryChangeBodySchema,
  type EmployeeDetail,
  type SalaryChangeBody,
  type SalaryChangeItem,
} from '@acme/shared';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../../db/client.ts';
import type { Clock } from '../../domain/clock.ts';
import { requires } from '../../http/guard.ts';
import { recordSalaryChange, type SalaryWrites } from './service.ts';

export function salaryRoutes(
  app: FastifyInstance,
  deps: { db: Db; clock: Clock; writes?: SalaryWrites },
) {
  // S2 (04 section 5.5).
  app.post(
    '/api/employees/:id/salary-changes',
    {
      onRequest: requires('salary.write'),
      schema: { params: employeeIdParamsSchema, body: salaryChangeBodySchema },
    },
    async (request, reply): Promise<{ employee: EmployeeDetail; change: SalaryChangeItem }> => {
      const { id } = request.params as { id: number };
      const result = await recordSalaryChange(
        deps.db,
        id,
        request.body as SalaryChangeBody,
        {
          today: deps.clock.today(),
          now: deps.clock.now().toISOString(),
          userId: request.viewer!.id,
        },
        deps.writes,
      );
      return reply.code(201).header('Location', `/api/employees/${id}`).send(result);
    },
  );
}
