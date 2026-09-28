import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '../../src/lib/whatsapp-flow';

type Scenario = { input: string; expect?: Partial<FlowState> };

function memoryStore(initialState: FlowState | null = null): WhatsAppFlowStore & { currentState: () => FlowState | null } {
  let state = initialState;
  return {
    activeBooking: async () => null,
    loadState: async () => state,
    saveState: async (_phone: string, nextState: FlowState | null) => {
      state = nextState;
    },
    createRentalRequest: async () => 'SIM-123',
    getRentalQuotes: async () => [],
    currentState: () => state,
  };
}

async function runScenario(name: string, steps: Scenario[]) {
  console.log(`\n=== Scenario: ${name} ===`);
  const store = memoryStore();
  const phone = 'test-phone';
  
  for (const step of steps) {
    console.log(`\nUser: ${step.input}`);
    const result = await getWhatsAppFlowReply(phone, step.input, store);
    const state = store.currentState();
    console.log(`Bot: ${(result.reply ?? '').split('\n')[0]} ...`); // Print only first line
    console.log(`State:`, state);
    
    // Check assertions if provided
    if (step.expect) {
      for (const [key, value] of Object.entries(step.expect)) {
        const actual = state?.[key as keyof FlowState];
        if (actual !== value) {
          console.error(`❌ FAILED: Expected ${key}=${value}, got ${actual}`);
        } else {
          console.log(`✅ Passed: ${key}=${value}`);
        }
      }
    }
  }
}

async function runAll() {
  await runScenario('Both locations at once', [
    { input: 'אני רוצה להשכיר רכב', expect: { step: 'rental_dates' } },
    { input: 'מחר עד ה-25 לחודש', expect: { step: 'rental_times' } },
    { input: '8 בבוקר', expect: { step: 'rental_times' } },
    { input: '10 בבוקר', expect: { step: 'rental_locations' } },
    { input: 'מנתבג לירושלים', expect: { pickupLocation: 'נתבג', dropoffLocation: 'ירושלים', step: 'rental_vehicle' } }
  ]);

  await runScenario('Times together', [
    { input: 'השכרת רכב', expect: { step: 'rental_dates' } },
    { input: 'מחר עד שישי', expect: { step: 'rental_times' } },
    { input: 'אקח ב-10 ואחזיר ב-14:00', expect: { pickupTime: '10:00', returnTime: '14:00', step: 'rental_locations' } }
  ]);

  await runScenario('Family trip is retained without assuming a category', [
    { input: 'השכרת רכב', expect: {} },
    { input: 'מחר עד מחרתיים', expect: {} },
    { input: '10:00 עד 10:00', expect: {} },
    { input: 'מתל אביב', expect: {} },
    { input: 'חיפה', expect: { step: 'rental_vehicle' } },
    { input: 'אנחנו זוג עם שלושה ילדים והרבה מזוודות', expect: { tripNeeds: 'children' } }
  ]);
}

runAll().catch(console.error);
