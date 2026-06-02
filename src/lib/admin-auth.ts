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

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const dot = token.lastIndexOf('.');
    if (dot === -1) return false;
    const payloadPart = token.slice(0, dot);
    const sigPart = token.slice(dot + 1);
    if (!sigPart) return false;

    const parts = payloadPart.split(':');
    if (parts[0] !== 'admin' || parts[1] !== '1' || !parts[2]) return false;

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
