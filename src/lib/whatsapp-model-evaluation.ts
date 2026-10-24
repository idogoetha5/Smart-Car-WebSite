import { AsyncLocalStorage } from 'node:async_hooks';

type Usage = { inputTokens: number; outputTokens: number; thinkingTokens: number };
type Evaluation = { model: 'gemini-3.8-flash'; usage: Usage | null };
const evaluation = new AsyncLocalStorage<Evaluation>();

/** Called only by the owner-authenticated rehearsal endpoint. Never a fallback,
 * environment override, public header selector or customer transport setting. */
export async function evaluateGeminiModel<T>(work: () => Promise<T>) {
  const context: Evaluation = { model: 'gemini-3.8-flash', usage: null };
  return evaluation.run(context, async () => ({ result: await work(), evaluation: context }));
}

export function activeModelEvaluation() { return evaluation.getStore(); }

export function recordEvaluationUsage(metadata: unknown) {
  const context = evaluation.getStore();
  if (!context || !metadata || typeof metadata !== 'object') return;
  const data = metadata as Record<string, unknown>;
  if (typeof data.promptTokenCount !== 'number' || typeof data.candidatesTokenCount !== 'number') return;
  const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
  context.usage = { inputTokens: (context.usage?.inputTokens ?? 0) + count(data.promptTokenCount), outputTokens: (context.usage?.outputTokens ?? 0) + count(data.candidatesTokenCount), thinkingTokens: (context.usage?.thinkingTokens ?? 0) + count(data.thoughtsTokenCount) };
}
