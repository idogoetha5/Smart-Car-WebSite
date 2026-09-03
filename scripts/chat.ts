import readline from 'readline';
import { getWhatsAppFlowReply, type FlowState } from '@/lib/whatsapp-flow';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const PHONE_NUMBER = '972501234567';

// In-memory store so it doesn't crash trying to connect to a real database
const memoryState = new Map<string, FlowState>();
const mockStore = {
  async activeBooking(_phone: string) { return null; },
  async loadState(phone: string) { return memoryState.get(phone) ?? null; },
  async saveState(phone: string, state: FlowState | null) {
    if (state) memoryState.set(phone, state);
    else memoryState.delete(phone);
  },
  async createRentalRequest(_phone: string, _state: FlowState) { return 'REQ-123'; },
  async getRentalQuotes() { return []; },
  async getCarsForSale() { return []; }
};

console.log('=============================================');
console.log('🤖 SmartCar WhatsApp Bot Simulator 🤖');
console.log('=============================================');
console.log('Type your message and press Enter to chat.');
console.log('Type "exit" to quit the simulator.\n');

async function askQuestion() {
  rl.question('👤 You: ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    try {
      const result = await getWhatsAppFlowReply(PHONE_NUMBER, input, mockStore);
      console.log(`\n🤖 Bot:\n${result.reply}\n`);
      if (result.escalate) {
        console.log(`[!] Handoff Triggered. Reason: ${result.escalateReason}`);
      }
    } catch (err) {
      console.error('Error processing reply:', err);
    }

    askQuestion();
  });
}

askQuestion();
