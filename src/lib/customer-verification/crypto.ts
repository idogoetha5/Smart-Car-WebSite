// Server-only: imports Node's crypto and reads a secret env var.
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Application-level encryption for stored card details.
 *
 * The key lives only in the CARD_ENCRYPTION_KEY environment variable
 * (32 random bytes, base64), never in the database or the repository. A
 * database dump or a leaked Supabase key therefore yields ciphertext only.
 *
 * Generate a key once:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 * Changing the key makes every stored card unreadable, so keep it safe.
 *
 * Format: v1.<iv>.<tag>.<ciphertext>, each part base64url.
 */

export interface CardSecret {
  number: string;
  expMonth: string;
  expYear: string;
  holderName: string;
  holderIdType: 'il' | 'passport';
  holderId: string;
}

function key(): Buffer {
  const raw = process.env.CARD_ENCRYPTION_KEY?.trim() ?? '';
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error('[card-crypto] CARD_ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  }
  return buf;
}

export function encryptionConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptCard(secret: CardSecret): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(secret), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.');
}

export function decryptCard(payload: string): CardSecret {
  const [v, iv, tag, ct] = payload.split('.');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('[card-crypto] unknown format');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const pt = Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]);
  return JSON.parse(pt.toString('utf8')) as CardSecret;
}
