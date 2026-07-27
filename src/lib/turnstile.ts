const SECRET = process.env.TURNSTILE_SECRET_KEY;
if (!SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('[turnstile] TURNSTILE_SECRET_KEY must be set in production');
}
// Cloudflare's official test secret — only ever used outside production
// (the throw above guarantees production always has the real secret).
const EFFECTIVE_SECRET = SECRET ?? '1x0000000000000000000000000000000AA';

// Hostnames allowed to have solved the challenge. Anything else means the
// token was solved on a page we don't control (token farming) — reject.
const ALLOWED_HOSTNAMES = new Set([
  'smartcar.co.il',
  'www.smartcar.co.il',
  'smartcar-psi.vercel.app',
  'localhost',
]);

export async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: EFFECTIVE_SECRET, response: token }),
    });
    const data = await res.json();
    if (data.success !== true) return false;
    // Cloudflare's test keys report hostname "example.com" — accept that
    // only outside production so local/dev testing keeps working.
    if (data.hostname && !ALLOWED_HOSTNAMES.has(data.hostname)) {
      if (process.env.NODE_ENV !== 'production' && data.hostname === 'example.com') return true;
      console.error('[turnstile] token solved on unexpected hostname:', data.hostname);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
