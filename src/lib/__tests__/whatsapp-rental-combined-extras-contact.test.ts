import { describe, expect, it } from 'vitest';
import { getRebuiltBotReply, type RebuildState, type RebuildStore } from '@/lib/whatsapp-rebuild';

describe('rental additions and contact in one reply', () => {
  it('hands off after the customer requests a booster and says there is nothing else', async () => {
    let state: RebuildState | null = {
      version: 2,
      phase: 'booking',
      step: 'rental_name',
      locale: 'en',
      booking: {
        pickupDate: '2026-12-14', returnDate: '2026-12-21',
        pickupLocation: 'Tel Aviv', returnLocation: 'Tel Aviv',
        vehicleNeed: 'family car', driverAgeRange: '24-plus', passengers: 4,
      },
      history: [
        { from: 'customer', text: 'Would a booster seat be possible for our older child?' },
        { from: 'bot', text: 'A booster seat can be requested. Would you like any additions, such as an additional driver?' },
      ],
    };
    const store: RebuildStore = {
      isSimulation: true,
      loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null,
      createRentalRequest: async () => { throw new Error('handoff must not create a formal booking'); },
      readTurn: async () => null,
    };
    const result = await getRebuiltBotReply('fictional-tourist', 'Yes, please note the booster seat. Nothing else. My name is Maya Cohen, and you can reach me on WhatsApp at 054-123-6789.', store);

    expect(result.state.booking.childSeats).toBe(1);
    expect(result.state.booking.childSeatType).toBe('booster');
    expect(result.state.booking.customerName).toBe('Maya Cohen');
    expect(result.state.rentalExtrasAnswered).toBe(true);
    expect(result.state.handedOff).toBe(true);
    expect(result.escalate).toBe(true);
    expect(result.reply).toMatch(/booster seat/i);
    expect(result.reply).not.toMatch(/would you like any additions|anything else/i);
  });
});
