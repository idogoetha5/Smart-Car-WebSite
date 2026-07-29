import { describe, it, expect } from 'vitest';
import { contactSchema } from '../validations';
import { readJsonBody } from '../request-body';

function valid(overrides: Record<string, unknown> = {}) {
  return {
    name: 'ישראל ישראלי',
    phone: '0501234567',
    email: 'customer@example.com',
    message: 'אשמח לקבל פרטים על השכרה לשבוע',
    ...overrides,
  };
}

describe('contactSchema', () => {
  it('accepts what the contact form posts', () => {
    expect(contactSchema.safeParse(valid({ turnstileToken: 'tok' })).success).toBe(true);
  });

  it('accepts a blank email, which the form sends when it is left empty', () => {
    expect(contactSchema.safeParse(valid({ email: '' })).success).toBe(true);
  });

  it('rejects an address that is not an address', () => {
    // The form marks the field type="email"; nothing stops a direct POST,
    // and this used to be stored and put in the reply-to header as typed.
    expect(contactSchema.safeParse(valid({ email: 'not-an-email' })).success).toBe(false);
  });

  it('rejects a phone number that cannot be dialled', () => {
    expect(contactSchema.safeParse(valid({ phone: '12345' })).success).toBe(false);
  });

  it('refuses an over-long message instead of silently truncating it', () => {
    // The old route sliced to 4000 characters, so the customer believed they
    // had sent something the team never received the end of.
    expect(contactSchema.safeParse(valid({ message: 'x'.repeat(4001) })).success).toBe(false);
  });

  it('treats a message of only whitespace as empty', () => {
    expect(contactSchema.safeParse(valid({ message: '     ' })).success).toBe(false);
  });

  it('rejects an undeclared key', () => {
    expect(contactSchema.safeParse(valid({ to_email: 'attacker@example.com' })).success).toBe(false);
  });

  it('trims what it stores', () => {
    const result = contactSchema.safeParse(valid({ name: '  דנה  ' }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('דנה');
  });
});

describe('readJsonBody', () => {
  const post = (body: string, headers: Record<string, string> = {}) =>
    new Request('https://example.com/api/contact', { method: 'POST', body, headers });

  it('returns the parsed object for a normal body', async () => {
    const result = await readJsonBody(post(JSON.stringify({ a: 1 })));
    expect(result).toEqual({ ok: true, value: { a: 1 } });
  });

  it('answers 400 rather than throwing on malformed JSON', async () => {
    // This is the case that used to escape request.json() and reach the
    // caller as a 500.
    const result = await readJsonBody(post('{not json'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it('rejects a JSON array, which is valid JSON but not a request body here', async () => {
    const result = await readJsonBody(post('[1,2,3]'));
    expect(result.ok).toBe(false);
  });

  it('rejects a body over the byte limit', async () => {
    const result = await readJsonBody(post(JSON.stringify({ m: 'x'.repeat(200) })), 100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(413);
  });

  it('does not take a lying content-length at face value', async () => {
    // Header says small, body is large — the bytes actually read decide.
    const big = JSON.stringify({ m: 'x'.repeat(500) });
    const result = await readJsonBody(post(big, { 'content-length': '10' }), 100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(413);
  });

  it('counts bytes, not characters, so multibyte text cannot slip past', async () => {
    // 60 Hebrew characters are 120 bytes in UTF-8.
    const result = await readJsonBody(post(JSON.stringify({ m: 'א'.repeat(60) })), 100);
    expect(result.ok).toBe(false);
  });
});
