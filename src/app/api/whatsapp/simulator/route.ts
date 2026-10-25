import { NextRequest, NextResponse } from 'next/server';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';
import { readBotTurn, type BotReading } from '@/lib/whatsapp-rebuild-gemini';
import { checkRateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';

type QuickReply = { label: string; message: string };
function quickReplies(state: RebuildState | null, reply: string): QuickReply[] {
  if (state?.step === 'rental_confirm') return state.locale === 'en'
    ? [{ label: 'I confirm', message: 'I confirm' }, { label: 'Keep discussing', message: "I don't want to book now" }]
    : [{ label: 'אני מאשר/ת', message: 'אני מאשר' }, { label: 'להמשיך להתלבט', message: 'לא רוצה להזמין עכשיו' }];
  if (!state || state.step === 'menu' && /ברוכים הבאים|Welcome to SmartCar/.test(reply)) return state?.locale === 'en'
    ? [{ label: 'Rent a car', message: 'I want to rent a car' }, { label: 'Existing booking', message: 'I need help with my booking' }, { label: 'Leasing or purchase', message: 'I want to discuss leasing' }, { label: 'Roadside help', message: 'My car broke down' }, { label: 'עברית', message: 'עברית' }]
    : [{ label: 'השכרת רכב', message: 'אני רוצה לשכור רכב' }, { label: 'הזמנה קיימת', message: 'אני צריך עזרה עם הזמנה קיימת' }, { label: 'ליסינג או רכישה', message: 'רוצה לברר על ליסינג' }, { label: 'עזרה בדרך', message: 'נתקעתי עם הרכב' }, { label: 'English', message: 'English' }];
  return [];
}

function simulationStore(sessionId: string, initialState: RebuildState | null, useAi: boolean) {
  let state = initialState;
  let understood: BotReading | null = null;
  return {
    isSimulation: true,
    activeBooking: async () => null,
    loadState: async () => state,
    saveState: async (_phone, next) => { state = next; },
    createRentalRequest: async () => `SIM-${sessionId.slice(0, 6).toUpperCase()}`,
    readTurn: async (...args) => { understood = useAi ? await readBotTurn(...args) : null; return understood; },
    currentState: () => state,
    understood: () => understood,
  } satisfies RebuildStore & { currentState: () => RebuildState | null; understood: () => BotReading | null };
}

export async function POST(request: NextRequest) {
  // Isolated rehearsal: no customer message, database rental request or
  // WhatsApp send. The state is supplied by the caller for this one turn.
  const payload = await request.json().catch(() => null) as { sessionId?: string; message?: string; state?: RebuildState | null } | null;
  const sessionId = payload?.sessionId?.trim() ?? '';
  const message = payload?.message?.trim() ?? '';
  if (!/^[a-zA-Z0-9_-]{12,80}$/.test(sessionId) || !message || message.length > 1000) return NextResponse.json({ error: 'Invalid simulation message' }, { status: 400 });
  const address = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const [visitorLimit, sessionLimit] = await Promise.all([
    checkRateLimit(`whatsapp-simulator:visitor:${address}`, 200, 60 * 60_000),
    checkRateLimit(`whatsapp-simulator:session:${sessionId}`, 20, 10 * 60_000),
  ]);
  if (!visitorLimit.success || !sessionLimit.success) return NextResponse.json({ error: 'Too many simulation messages' }, { status: 429 });
  const initialState = payload?.state?.version === 2 && ['he', 'en'].includes(payload.state.locale) ? payload.state : null;
  const aiRehearsal = request.headers.get('x-smartcar-debug') === '1' && request.headers.get('x-smartcar-engine') === 'ai';
  const useAi = aiRehearsal || request.headers.get('x-smartcar-engine') !== 'local' && process.env.WHATSAPP_ENGINE === 'ai';
  const store = simulationStore(sessionId, initialState, useAi);
  const result = await getRebuiltBotReply(`simulation-${sessionId}`, message, store);
  return NextResponse.json({
    reply: result.reply,
    escalated: Boolean(result.escalate),
    quickReplies: quickReplies(result.state, result.reply),
    state: store.currentState(),
    source: result.source,
    model: result.model,
    understood: request.headers.get('x-smartcar-debug') === '1' ? store.understood() : undefined,
  });
}
