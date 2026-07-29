/**
 * Reading a JSON request body without trusting it.
 *
 * `await request.json()` on its own has two problems on a public route: a
 * malformed body throws, which surfaces to the caller as a 500 and looks
 * like a server fault rather than a bad request; and nothing bounds the
 * size, so the route will happily buffer whatever it is sent before any
 * validator gets a say.
 */

/** 64 KB. The largest genuine payload here is a booking, well under 4 KB. */
const MAX_BODY_BYTES = 64 * 1024;

export type JsonBodyResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: number; error: string };

export async function readJsonBody(
  request: Request,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<JsonBodyResult> {
  const declared = request.headers.get('content-length');
  if (declared && Number(declared) > maxBytes) {
    return { ok: false, status: 413, error: 'גוף הבקשה גדול מדי' };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400, error: 'גוף הבקשה אינו תקין' };
  }

  // content-length may be absent or simply wrong; the bytes actually read
  // are the only number worth enforcing.
  if (new TextEncoder().encode(text).length > maxBytes) {
    return { ok: false, status: 413, error: 'גוף הבקשה גדול מדי' };
  }

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, status: 400, error: 'גוף הבקשה אינו תקין' };
  }

  // A JSON array or bare string parses fine but is not a request body any
  // of these routes can read; rejecting here keeps the schemas simpler.
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, status: 400, error: 'גוף הבקשה אינו תקין' };
  }

  return { ok: true, value: value as Record<string, unknown> };
}
