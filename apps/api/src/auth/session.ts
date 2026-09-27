import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../http/errors.js';

/**
 * Single-admin session: a signed, expiring token in an httpOnly cookie. The browser reaches the API
 * through the web host's /api proxy, so the cookie is first-party and SameSite=Strict.
 */
export const SESSION_COOKIE = 'kzv_admin';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  // Hash first so the comparison is constant-time regardless of input length.
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function passwordMatches(candidate: string, expected: string): boolean {
  return safeEqual(candidate, expected);
}

export function createSessionToken(secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS })).toString(
    'base64url',
  );
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof exp === 'number' && exp * 1000 > now;
  } catch {
    return false;
  }
}

export function makeRequireAdmin(secret: string | undefined) {
  return async function requireAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!secret) throw new AppError(503, 'ADMIN_DISABLED', 'Administracija nije podešena (SESSION_SECRET).');
    if (!verifySessionToken(request.cookies[SESSION_COOKIE], secret)) {
      throw new AppError(401, 'UNAUTHORIZED', 'Prijavite se ponovo.');
    }
  };
}
