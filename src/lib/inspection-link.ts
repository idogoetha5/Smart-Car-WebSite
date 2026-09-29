import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Short-lived signed links for the customer-facing inspection-signing page.
 *
 * Deliberately its own file/secret rather than reusing signed-link.ts: the
 * secret is domain-separated so an inspection link can never be replayed as
 * a condition-report link (or vice versa), even though both are HMACs
 * derived from the same fallback key. The subject is an inspection id (not
 * a booking id) — a booking can have both a pickup and a return inspection.
 */

const PURPOSE_INSPECTION = 'vehicle-inspection';

function secret(): string {
  const value = process.env.INSPECTION_LINK_SECRET || process.env.ADMIN_COOKIE_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[inspection-link] INSPECTION_LINK_SECRET or ADMIN_COOKIE_SECRET must be set in production');
    }
    return 'dev-only-insecure-inspection-link-secret';
  }
  return value;
}

function sign(subject: string, expiresAt: number): string {
  return createHmac('sha256', secret())
    .update(`${PURPOSE_INSPECTION}.${subject}.${expiresAt}`, 'utf8')
    .digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface InspectionLinkResult {
  valid: boolean;
  inspectionId?: string;
  reason?: 'malformed' | 'expired' | 'bad-signature';
}

// 30 days: the link must keep working after signing too, per spec — it's
// how the customer (and Daniel) can come back and view the signed PDF/video.
export function createInspectionToken(inspectionId: string, ttlHours = 24 * 30): string {
  const expiresAt = Date.now() + ttlHours * 60 * 60 * 1000;
  const sig = sign(inspectionId, expiresAt);
  return `${inspectionId}.${expiresAt}.${sig}`;
}

export function verifyInspectionToken(token: string | undefined | null): InspectionLinkResult {
  if (!token) return { valid: false, reason: 'malformed' };

  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed' };

  const [inspectionId, expRaw, sig] = parts;
  const expiresAt = Number(expRaw);
  if (!inspectionId || !Number.isFinite(expiresAt)) return { valid: false, reason: 'malformed' };

  const expected = sign(inspectionId, expiresAt);
  if (!safeEqual(sig, expected)) return { valid: false, reason: 'bad-signature' };

  if (Date.now() > expiresAt) return { valid: false, reason: 'expired' };

  return { valid: true, inspectionId };
}
