import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '@/lib/whatsapp-flow';

export const runtime = 'nodejs';

type QuickReply = { label: string; message: string };

function quickReplies(state: FlowState | null | undefined, reply: string): QuickReply[] {
  if (state?.step === 'rental_vehicle') {
    return state.locale === 'en'
      ? [{ label: 'Small & economical', message: '1' }, { label: 'Family car', message: '2' }, { label: 'Crossover / SUV', message: '3' }, { label: '7 seats or more', message: '4' }, { label: 'Luxury car', message: '5' }, { label: 'Help me choose', message: '6' }]
      : [{ label: 'קטן וחסכוני', message: '1' }, { label: 'רכב משפחתי', message: '2' }, { label: 'קרוסאובר / SUV', message: '3' }, { label: '7 מקומות ומעלה', message: '4' }, { label: 'רכב יוקרתי', message: '5' }, { label: 'עזרו לי לבחור', message: '6' }];
  }
  if (state?.step === 'rental_confirm') {
    return state.locale === 'en'
      ? [{ label: 'I confirm', message: 'I confirm' }, { label: 'Start again', message: 'menu' }]
      : [{ label: 'אני מאשר/ת', message: 'אני מאשר/ת' }, { label: 'התחלה מחדש', message: 'תפריט' }];
  }
  if ((!state || state.step === 'menu') && (reply.includes('1️⃣') || reply.includes('איך נוכל לעזור') || reply.includes('Welcome to SmartCar'))) {
    const english = state?.locale === 'en' || /Welcome|accident|flat tyre|breakdown|representative/i.test(reply);
    return english
      ? [{ label: 'Rent a car', message: '1' }, { label: 'Existing booking', message: '2' }, { label: 'Leasing / purchase', message: '3' }, { label: 'Accident or breakdown', message: '6' }, { label: 'עברית', message: 'עברית' }]
      : [{ label: 'השכרת רכב', message: '1' }, { label: 'בירור הזמנה קיימת', message: '2' }, { label: 'ליסינג או רכישה', message: '3' }, { label: 'תאונה, פנצ׳ר או תקלה', message: '6' }, { label: 'English', message: 'English' }];
  }
  return [];
}

function simulationStore(sessionId: string, initialState: FlowState | null) {
  let state = initialState;
  return {
    activeBooking: async () => null,
    loadState: async () => state,
    saveState: async (_phone, nextState) => {
      state = nextState;
    },
    createRentalRequest: async () => `SIM-${sessionId.slice(0, 6).toUpperCase()}`,
    getRentalQuotes: async (st) => {
      const { getWhatsAppRentalQuotes } = await import('@/lib/whatsapp-rental-quotes');
      return getWhatsAppRentalQuotes(st.vehiclePreference, st.pickupDate!, st.dropoffDate!);
    },
    currentState: () => state,
  } satisfies WhatsAppFlowStore & { currentState: () => FlowState | null };
}

export async function POST(request: NextRequest) {
  // The screen is an isolated rehearsal. It never stores a customer, sends
  // WhatsApp, or creates a real rental request.

  const payload = await request.json().catch(() => null) as { sessionId?: string; message?: string; state?: FlowState | null } | null;
  const sessionId = payload?.sessionId?.trim() ?? '';
  const message = payload?.message?.trim() ?? '';
  if (!/^[a-zA-Z0-9_-]{12,80}$/.test(sessionId) || !message || message.length > 1000) {
    return NextResponse.json({ error: 'Invalid simulation message' }, { status: 400 });
  }

  const initialState = payload?.state && ['menu', 'rental_dates', 'rental_times', 'rental_locations', 'rental_vehicle', 'rental_name', 'rental_email', 'rental_confirm'].includes(payload.state.step)
    && (payload.state.locale === 'he' || payload.state.locale === 'en') ? payload.state : null;
  const store = simulationStore(sessionId, initialState);
  const result = await getWhatsAppFlowReply(`simulation-${sessionId}`, message, store);
  const state = store.currentState();
  return NextResponse.json({
    reply: result.reply ?? '',
    escalated: Boolean(result.escalate),
    quickReplies: quickReplies(state, result.reply ?? ''),
    state,
  });
}
