import { getWhatsAppFlowReply, type FlowState, type WhatsAppFlowStore } from '../../src/lib/whatsapp-flow';

async function main() {
  let state: FlowState | null = null;
  const store: WhatsAppFlowStore = {
    activeBooking: async () => null,
    loadState: async () => state,
    saveState: async (_phone, nextState) => { state = nextState; },
    createRentalRequest: async () => null,
  };
  const res = await getWhatsAppFlowReply('test-phone', 'אני מחפש להשכיר רכב לסוף השבוע הבא', store);
  console.log(JSON.stringify(res, null, 2));
}
main();
