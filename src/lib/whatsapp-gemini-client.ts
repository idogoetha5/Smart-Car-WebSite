import { reportBotIncident, type BotIncident } from '@/lib/whatsapp-incidents';
import { activeModelEvaluation, recordEvaluationUsage } from '@/lib/whatsapp-model-evaluation';

/** Fresh, bounded provider connection. No booking actions or customer logging. */
type Circuit = { until: number; probing: boolean };
const circuits = new Map<string, Circuit>();
const REQUEST_MS = 8000;
let reportedMissingKey = false;

async function notify(kind: BotIncident) {
  // A failed private experiment is not an outage of the customer model.
  if (activeModelEvaluation()) return;
  // Notification failure must never prevent the local backup from replying.
  try { await reportBotIncident(kind); }
  catch { console.error('[whatsapp-gemini] incident notification unavailable'); }
}

export type GeminiConnectionResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'missing_key' | 'cooldown' | 'timeout' | 'network' | 'http' | 'empty'; status?: number };

/** For tests: forget every model's cooldown. */
export function resetModelCooldowns() {
  circuits.clear();
  reportedMissingKey = false;
}

/** Per-instance cooldown; it is a latency safeguard, not a distributed quota limit. */
export async function generateSmartCarContent(params: { model: string; body: unknown; timeoutMs?: number }): Promise<GeminiConnectionResult> {
  // Dedicated bot credential must not replace the driver's OCR credential.
  const key = process.env.WHATSAPP_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    if (!activeModelEvaluation() && !reportedMissingKey) { reportedMissingKey = true; await notify('ai_unavailable'); }
    return { ok: false, reason: 'missing_key' };
  }
  if (!activeModelEvaluation()) reportedMissingKey = false;
  // Reset naturally when the configured model changes. Never retain the key.
  const circuit = circuits.get(params.model);
  if (circuit && (circuit.until > Date.now() || circuit.probing)) return { ok: false, reason: 'cooldown' };
  if (circuit) circuit.probing = true;
  const coolDown = (ms: number) => circuits.set(params.model, { until: Date.now() + ms, probing: false });
  try {
    const originalBody = params.body && typeof params.body === 'object' ? params.body as Record<string, unknown> : null;
    const body = params.model === 'gemini-3.8-flash' && originalBody
      ? { ...originalBody, generationConfig: { ...(originalBody.generationConfig as object ?? {}), thinkingConfig: { thinkingLevel: 'low' } } }
      : params.body;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body), signal: AbortSignal.timeout(Math.max(1, Math.min(REQUEST_MS, Math.floor(params.timeoutMs ?? REQUEST_MS)))),
    });
    if (!response.ok) {
      // Do not repeatedly retry exhausted daily/free quota on every customer turn.
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = response.status === 429
        ? Math.max(30_000, Math.min(Number.isFinite(retryAfter) ? retryAfter * 1000 : 60_000, 300_000))
        : [400, 401, 403, 404].includes(response.status) ? 300_000 : 30_000;
      coolDown(delay);
      console.error('[whatsapp-gemini] provider HTTP %s; using local knowledge', response.status);
      await notify('ai_unavailable');
      return { ok: false, reason: 'http', status: response.status };
    }
    const data = await response.json();
    recordEvaluationUsage(data?.usageMetadata);
    const text = data?.candidates?.[0]?.content?.parts
      ?.filter((part: { thought?: boolean }) => !part.thought)
      .map((part: { text?: string }) => part.text ?? '').join('') ?? '';
    if (!text.trim()) {
      coolDown(15_000);
      await notify('ai_unavailable');
      return { ok: false, reason: 'empty' };
    }
    circuits.delete(params.model);
    if (circuit) await notify('ai_recovered');
    return { ok: true, text };
  } catch (error) {
    coolDown(30_000);
    await notify('ai_unavailable');
    return { ok: false, reason: error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'timeout' : 'network' };
  }
}

/** The JSON object in a model's answer, also when it is wrapped in a code fence or a sentence. */
export function readJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('no JSON object in the answer');
    return JSON.parse(text.slice(start, end + 1));
  }
}
