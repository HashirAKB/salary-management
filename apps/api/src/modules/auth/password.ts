export type ScryptParams = { N: number; r: number; p: number };

export const PRODUCTION_SCRYPT: ScryptParams = { N: 32768, r: 8, p: 3 };

export async function hashPassword(_password: string, _params: ScryptParams): Promise<string> {
  throw new Error('not implemented');
}

export async function verifyPassword(_password: string, _stored: string): Promise<boolean> {
  throw new Error('not implemented');
}
