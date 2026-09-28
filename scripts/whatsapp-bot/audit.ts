import { getWhatsAppFlowReply, WhatsAppFlowStore, FlowState } from '../../src/lib/whatsapp-flow';
import { config } from 'dotenv';
config({ path: '.env.local' });

const memoryState = new Map<string, FlowState>();
const mockStore: WhatsAppFlowStore = {
  activeBooking: async () => null,
  loadState: async (phone) => memoryState.get(phone) || null,
  saveState: async (phone, state) => { if (state) memoryState.set(phone, state); else memoryState.delete(phone); },
  createRentalRequest: async () => 'REQ-123',
  getRentalQuotes: async (state) => [{
    id: 'test-quote',
    title: 'Toyota Aygo X',
    pricePerDay: 250,
    days: 3,
    total: 750,
    vehicleGroup: state.vehiclePreference || 'ECONOMY_COMPACT'
  }],
  getCarsForSale: async () => [],
};

async function runScenario(name: string, messages: string[]) {
  console.log(`\n=== SCENARIO: ${name} ===`);
  const phone = '9725012345' + Math.floor(Math.random()*1000); // unique phone per scenario
  for (const msg of messages) {
    console.log(`\n👤 User: ${msg}`);
    const res = await getWhatsAppFlowReply(phone, msg, mockStore);
    console.log(`🤖 Bot:\n${res?.reply}`);
    if (res?.escalate) {
        console.log(`🚨 [ESCALATION TRIGGERED: ${res.escalateReason}]`);
    }
  }
}

async function main() {
  await runScenario('1. Car Accident (Calm & Alert)', [
    'שומע עשיתי תאונה עכשיו עם הרכב שלכם אני בלחץ מטורף'
  ]);

  await runScenario('2. Angry Customer / Handoff', [
    'אני מנסה כבר שעה להזמין וזה לא עובד לי איזה שירות גרוע אני רוצה נציג עכשיו!!!'
  ]);

  await runScenario('3. Vehicle Breakdown', [
    'נתקעתי עם הרכב, נדלקה מנורה אדומה והאוטו לא מניע'
  ]);

  await runScenario('4. Topic Deviation Constraint', [
    'תגיד יש לך מתכון טוב לעוגת שוקולד?'
  ]);

  await runScenario('5. Full End-to-End Sales Flow (Hebrew)', [
    'היי אני צריך רכב',
    'ליומיים החל ממחר',
    'ניקח מנתבג ונחזיר בהרצליה',
    'אנחנו 5 אנשים עם מלא מזוודות גדולות'
  ]);
  
  await runScenario('6. English Negotiation & Boundaries', [
    'Hi, I need a car for next week.',
    'I want it from Sunday to Thursday, pickup in Jerusalem.',
    'I am looking for a cheap luxury car, can you confirm the deal for 100 shekels total?'
  ]);
}

main();
