import { randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyRentalQuoteLinkToken } from '@/lib/quote-link';

/** 96 random bits: short enough for WhatsApp, not a guessable quote number. */
export function createQuoteShortToken(): string {
  return randomBytes(12).toString('base64url');
}

export function isQuoteShortToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{16}$/.test(token);
}

/** Persist an opaque alias, keeping the signed document's expiry unchanged. */
export async function shortenQuoteToken(signedToken: string): Promise<string> {
  if (!verifyRentalQuoteLinkToken(signedToken).valid) {
    throw new Error('Cannot shorten an invalid document link');
  }
  const supabase = createAdminClient();
  for (let attempt = 0; attempt < 3; attempt++) {
    const token = createQuoteShortToken();
    const { error } = await supabase.from('quote_short_links')
      .insert({ token, signed_token: signedToken });
    if (!error) return token;
    // Never overwrite another document, even in the unlikely event of a collision.
    if (error.code !== '23505') throw new Error('Could not save document link');
  }
  throw new Error('Could not allocate document link');
}

export async function resolveQuoteShortToken(token: string): Promise<string | null> {
  if (!isQuoteShortToken(token)) return null;
  const { data, error } = await createAdminClient().from('quote_short_links')
    .select('signed_token').eq('token', token).maybeSingle();
  if (error) throw new Error('Could not resolve document link');
  return typeof data?.signed_token === 'string' ? data.signed_token : null;
}
