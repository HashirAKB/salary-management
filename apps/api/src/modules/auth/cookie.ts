// The session cookie `sid` (ADR 0006). Hand-rolled: no cookie plugin is named in the docs.
export const SESSION_COOKIE = 'sid';
export const SESSION_SECONDS = 8 * 60 * 60;

export function sessionCookie(token: string, { secure }: { secure: boolean }): string {
  const attributes = ['HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${SESSION_SECONDS}`];
  if (secure) attributes.push('Secure');
  return [`${SESSION_COOKIE}=${token}`, ...attributes].join('; ');
}
