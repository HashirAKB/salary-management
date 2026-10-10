import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

export type ScryptParams = { N: number; r: number; p: number };

// ADR 0006: one of OWASP's equivalent scrypt settings, 32 MiB per hash.
export const PRODUCTION_SCRYPT: ScryptParams = { N: 32768, r: 8, p: 3 };

const KEY_LENGTH = 32;

function derive(password: string, salt: Buffer, { N, r, p }: ScryptParams): Promise<Buffer> {
  // scrypt needs 128 * N * r bytes; Node's default maxmem (32 MiB) is exactly the production cost.
  const options: ScryptOptions = { N, r, p, maxmem: 256 * N * r };
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

// Stored as scrypt$N$r$p$<salt base64>$<hash base64> (03 section 7).
export async function hashPassword(password: string, params: ScryptParams): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, params);
  return [
    'scrypt',
    params.N,
    params.r,
    params.p,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [, N, r, p, salt = '', hash = ''] = stored.split('$');
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
