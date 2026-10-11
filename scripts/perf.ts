// Times the read paths at 10,000 employees, with and without the secondary indexes (08 section 6).
// Seeds a throwaway SQLite file, serves the real app on a real socket, logs in as HR Admin and
// times each request over HTTP. Run with `npm run perf`; it never touches DATABASE_URL.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir, cpus, totalmem } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../apps/api/src/app.ts';
import { loadConfig } from '../apps/api/src/config.ts';
import { createDb } from '../apps/api/src/db/client.ts';
import { systemClock } from '../apps/api/src/domain/clock.ts';
import { runSeed } from '../apps/api/src/seed/cli.ts';

const RUNS = Number(process.env.PERF_RUNS ?? 30);
const WARMUP = 3;
const PASSWORD = 'perf-script-password';

// 0001_init.sql, indexes I2 to I7 and I12 to I14.
const INDEXES = [
  'ix_employees_status_name',
  'ix_employees_cohort',
  'ix_employees_title_level',
  'ix_employees_salary_date',
  'ix_employees_hire_date',
  'ix_salary_changes_employee',
  'ix_sessions_user',
  'ix_ask_log_user_time',
  'ix_ask_log_time',
];

const REQUESTS: { name: string; budgetMs: number; path: string }[] = [
  { name: 'List, default page (page 1, 50, name)', budgetMs: 300, path: '/api/employees' },
  {
    name: 'List, sorted by salary in USD',
    budgetMs: 300,
    path: '/api/employees?sort=salaryUsd&order=desc',
  },
  { name: 'Insights summary (I1)', budgetMs: 500, path: '/api/insights/summary' },
  { name: 'Pay distribution by country (I2)', budgetMs: 500, path: '/api/insights/pay-distribution' },
  { name: 'Pay equity (I3)', budgetMs: 500, path: '/api/insights/pay-equity' },
];

const quiet = () => {};

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
}

async function main() {
  const dir = await mkdtemp(join(tmpdir(), 'acme-perf-'));
  const env = {
    DATABASE_URL: `file:${join(dir, 'perf.db')}`,
    LOG_LEVEL: 'silent',
    DEMO_HR_ADMIN_PASSWORD: PASSWORD,
    DEMO_HR_VIEWER_PASSWORD: PASSWORD,
    DEMO_FINANCE_PASSWORD: PASSWORD,
  };
  try {
    const code = await runSeed(env, { openDb: createDb, log: quiet, error: console.error });
    if (code !== 0) throw new Error('seed failed');

    const config = loadConfig(env);
    const db = createDb(config.databaseUrl);
    const app = buildApp({ db, clock: systemClock, config });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;

    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'hr.admin@acme.test', password: PASSWORD }),
    });
    if (!login.ok) throw new Error(`login failed: ${login.status}`);
    const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

    async function measure(phase: string) {
      console.log(`\n${phase} (${RUNS} runs after ${WARMUP} warm-up, ms)`);
      console.log('request | median | p95 | max | budget');
      for (const r of REQUESTS) {
        const times: number[] = [];
        for (let i = 0; i < WARMUP + RUNS; i++) {
          const start = performance.now();
          const res = await fetch(base + r.path, { headers: { cookie } });
          await res.arrayBuffer();
          const ms = performance.now() - start;
          if (!res.ok) throw new Error(`${r.path} answered ${res.status}`);
          if (i >= WARMUP) times.push(ms);
        }
        times.sort((a, b) => a - b);
        const f = (n: number) => n.toFixed(1);
        console.log(
          `${r.name} | ${f(percentile(times, 50))} | ${f(percentile(times, 95))} | ${f(times.at(-1)!)} | ${r.budgetMs}`,
        );
      }
    }

    console.log(`node ${process.version}, ${cpus()[0]?.model}, ${cpus().length} cpus`);
    console.log(`${Math.round(totalmem() / 2 ** 30)} GiB RAM, ${process.platform} ${process.arch}`);
    const count = await db.$client.execute('SELECT COUNT(*) AS n FROM employees');
    console.log(`employees: ${count.rows[0]!.n}`);

    await measure('With indexes');
    for (const name of INDEXES) await db.$client.execute(`DROP INDEX ${name}`);
    await measure('Without indexes (all 9 dropped)');

    await app.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

await main();
