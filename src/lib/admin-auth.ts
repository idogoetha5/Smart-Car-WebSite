const TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

function getSecret(): string {
  const secret =
    (typeof process !== 'undefined' && process.env.ADMIN_COOKIE_SECRET) ||
    '';
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[admin-auth] ADMIN_COOKIE_SECRET must be set in production');
    }
    console.warn('[admin-auth] No ADMIN_COOKIE_SECRET configured — admin auth is insecure in this environment');
    return 'dev-only-insecure-secret';
  }
  return secret;
}

async function getKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function b64urlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function signAdminToken(): Promise<string> {
  const ts = Math.floor(Date.now() / 1000);
  const payload = `admin:1:${ts}`;
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${b64urlEncode(sig)}`;
}

async function verifyTokenWithKind(token: string, kind: string): Promise<boolean> {
  try {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return false;
    const payloadPart = token.slice(0, dot);
    const sigPart = token.slice(dot + 1);
    if (!sigPart) return false;

    const parts = payloadPart.split(':');
    if (parts[0] !== kind || parts[1] !== '1' || !parts[2]) return false;

    const ts = parseInt(parts[2], 10);
    if (isNaN(ts) || Math.floor(Date.now() / 1000) - ts > TOKEN_MAX_AGE) return false;

    const key = await getKey();
    const sigBytes = b64urlDecode(sigPart);
    const sigBuffer: ArrayBuffer = sigBytes.buffer instanceof ArrayBuffer
      ? sigBytes.buffer.slice(sigBytes.byteOffset, sigBytes.byteOffset + sigBytes.byteLength)
      : new Uint8Array(sigBytes).buffer;
    return await crypto.subtle.verify('HMAC', key, sigBuffer, new TextEncoder().encode(payloadPart));
  } catch {
    return false;
  }
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  return verifyTokenWithKind(token, 'admin');
}

/**
 * A narrower credential for Daniel's WhatsApp-inbox trial (see the plan) —
 * gated by a plain PIN rather than the password+TOTP admin login, and
 * accepted only by the whatsapp conversation routes, never by
 * verifyAdminToken. So a leaked inbox cookie exposes WhatsApp threads, not
 * bookings, leasing requests or pricing.
 */
export async function signInboxToken(): Promise<string> {
  const ts = Math.floor(Date.now() / 1000);
  const payload = `inbox:1:${ts}`;
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${b64urlEncode(sig)}`;
}

export async function verifyInboxToken(token: string): Promise<boolean> {
  return verifyTokenWithKind(token, 'inbox');
}

const DRIVER_TOKEN_MAX_AGE = 30 * 24 * 60 * 60; // 30 days — drivers stay logged in on their phone

/**
 * Driver-app credential (see the plan) — deliberately signed with its own
 * secret, not ADMIN_COOKIE_SECRET, so a leaked driver cookie can never be
 * forged into (or replayed as) an admin or inbox cookie even in a signing
 * implementation bug. Unlike the admin/inbox kinds above, this one carries
 * an identity: which driver is logged in, so inspections can record who
 * performed them.
 */
function getDriverSecret(): string {
  const secret =
    (typeof process !== 'undefined' && process.env.DRIVER_COOKIE_SECRET) ||
    '';
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[admin-auth] DRIVER_COOKIE_SECRET must be set in production');
    }
    console.warn('[admin-auth] No DRIVER_COOKIE_SECRET configured — driver auth is insecure in this environment');
    return 'dev-only-insecure-driver-secret';
  }
  return secret;
}

async function getDriverKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(getDriverSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** Driver ids are the same 'c'+uuid-shaped text ids used everywhere in this
 * app — alphanumeric only, so embedding one positionally in a colon-joined
 * payload is safe (it can never contain a ':' to break parsing). */
export async function signDriverToken(driverId: string): Promise<string> {
  const ts = Math.floor(Date.now() / 1000);
  const payload = `driver:1:${driverId}:${ts}`;
  const key = await getDriverKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${b64urlEncode(sig)}`;
}

/** Returns the authenticated driverId, or null if the token is missing, malformed, expired or forged. */
export async function verifyDriverToken(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  try {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return null;
    const payloadPart = token.slice(0, dot);
    const sigPart = token.slice(dot + 1);
    if (!sigPart) return null;

    const parts = payloadPart.split(':');
    if (parts.length !== 4 || parts[0] !== 'driver' || parts[1] !== '1' || !parts[2] || !parts[3]) return null;
    const driverId = parts[2];

    const ts = parseInt(parts[3], 10);
    if (isNaN(ts) || Math.floor(Date.now() / 1000) - ts > DRIVER_TOKEN_MAX_AGE) return null;

    const key = await getDriverKey();
    const sigBytes = b64urlDecode(sigPart);
    const sigBuffer: ArrayBuffer = sigBytes.buffer instanceof ArrayBuffer
      ? sigBytes.buffer.slice(sigBytes.byteOffset, sigBytes.byteOffset + sigBytes.byteLength)
      : new Uint8Array(sigBytes).buffer;
    const valid = await crypto.subtle.verify('HMAC', key, sigBuffer, new TextEncoder().encode(payloadPart));
    return valid ? driverId : null;
  } catch {
    return null;
  }
}
