/** Fresh, bounded provider connection. No booking actions or customer logging. */
type Circuit = { until: number; probing: boolean };
const circuits = new Map<string, Circuit>();
const REQUEST_MS = 8000;

export type GeminiConnectionResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'missing_key' | 'cooldown' | 'timeout' | 'network' | 'http' | 'empty'; status?: number };

/** Per-instance cooldown; it is a latency safeguard, not a distributed quota limit. */
export async function generateSmartCarContent(params: { model: string; body: unknown }): Promise<GeminiConnectionResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, reason: 'missing_key' };
  // Reset naturally when the configured model changes. Never retain the key.
  const circuit = circuits.get(params.model);
  if (circuit && (circuit.until > Date.now() || circuit.probing)) return { ok: false, reason: 'cooldown' };
  if (circuit) circuit.probing = true;
  const coolDown = (ms: number) => circuits.set(params.model, { until: Date.now() + ms, probing: false });
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(params.body), signal: AbortSignal.timeout(REQUEST_MS),
    });
    if (!response.ok) {
      // Do not repeatedly retry exhausted daily/free quota on every customer turn.
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = response.status === 429
        ? Math.max(30_000, Math.min(Number.isFinite(retryAfter) ? retryAfter * 1000 : 60_000, 300_000))
        : [400, 401, 403, 404].includes(response.status) ? 300_000 : 30_000;
      coolDown(delay);
      console.error('[whatsapp-gemini] provider HTTP %s; using local knowledge', response.status);
      return { ok: false, reason: 'http', status: response.status };
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.filter((part: { thought?: boolean }) => !part.thought)
      .map((part: { text?: string }) => part.text ?? '').join('') ?? '';
    if (!text.trim()) {
      coolDown(15_000);
      return { ok: false, reason: 'empty' };
    }
    circuits.delete(params.model);
    return { ok: true, text };
  } catch (error) {
    coolDown(30_000);
    return { ok: false, reason: error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'timeout' : 'network' };
  }
}
