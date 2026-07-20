const SECRET = process.env.TURNSTILE_SECRET_KEY;
if (!SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('[turnstile] TURNSTILE_SECRET_KEY must be set in production');
}
const EFFECTIVE_SECRET = SECRET ?? '1x0000000000000000000000000000000AA';

// TEMPORARY (2026-07-20) — see src/components/ui/Turnstile.tsx for why.
// Must match NEXT_PUBLIC_TURNSTILE_BYPASS. Remove both once the real
// Cloudflare widget works again.
const BYPASS = process.env.TURNSTILE_BYPASS === 'true';

export async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  if (BYPASS && token === 'BYPASS') {
    console.warn('[turnstile] BYPASS active — verification skipped. Remove TURNSTILE_BYPASS once the Cloudflare widget is fixed.');
    return true;
  }
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: EFFECTIVE_SECRET, response: token }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}
