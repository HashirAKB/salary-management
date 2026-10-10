import type { FastifyServerOptions } from 'fastify';
import type { Config } from '../config.ts';

const REDACTED = '[Redacted]';
const SECRET_KEYS = new Set(['cookie', 'set-cookie', 'password']);

// Salary amounts (`*Minor`), passwords and the session cookie never reach the logs, at any depth
// (05 section 5.0).
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [
      key,
      SECRET_KEYS.has(key.toLowerCase()) || key.endsWith('Minor') ? REDACTED : redact(inner),
    ]),
  );
}

export function loggerOptions(
  config: Config,
  stream?: { write(line: string): void },
): FastifyServerOptions['logger'] {
  return {
    level: config.logLevel,
    formatters: { log: (entry) => redact(entry) as Record<string, unknown> },
    ...(stream ? { stream } : {}),
  };
}
