// Server-only helpers shared by the customer and admin routes.
import { createAdminClient } from '@/lib/supabase/server';

export const CV_BUCKET = 'customer-verifications';
export const LINK_TTL_HOURS = 72;
export const TOKEN_RE = /^[A-Za-z0-9_-]{20,80}$/;
/** Tokens issued by the fixed public link start with this; admin-created ones never do. */
export const PUBLIC_TOKEN_PREFIX = 'p_';
export const PUBLIC_LINK_TTL_HOURS = 3;

export interface VerificationRow {
  id: string;
  token: string;
  status: 'SENT' | 'COMPLETED' | 'CANCELLED';
  customer_name: string | null;
  customer_phone: string;
  booking_ref: string | null;
  locale: string;
  expires_at: string;
  completed_at: string | null;
  license_front_path: string | null;
  license_back_path: string | null;
  card_ciphertext: string | null;
  card_last4: string | null;
  card_brand: string | null;
  card_expiry: string | null;
  card_holder_name: string | null;
  card_holder_id_type: string | null;
  consent_at: string | null;
  internal_notes: string | null;
  created_at: string;
}

/** The link's row if it can still be filled in, otherwise null. */
export async function openVerificationByToken(token: string): Promise<VerificationRow | null> {
  if (!TOKEN_RE.test(token)) return null;
  const { data } = await createAdminClient()
    .from('customer_verifications')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  const row = data as VerificationRow | null;
  if (!row || row.status !== 'SENT' || new Date(row.expires_at) < new Date()) return null;
  return row;
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export async function logAccess(request: Request, verificationId: string, action: 'VIEW' | 'REVEAL_CARD' | 'DELETE_CARD') {
  const { error } = await createAdminClient().from('customer_verification_access_log').insert({
    verification_id: verificationId,
    action,
    ip: clientIp(request),
    user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
  });
  if (error) console.error('[customer-verification] access log', error.message);
}

/** Responses that carry personal data must never be cached anywhere. */
export const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };
