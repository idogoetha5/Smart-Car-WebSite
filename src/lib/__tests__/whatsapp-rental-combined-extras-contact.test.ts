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

  it('retains a tourist family preference, party size and booster request before an explicit team handoff', async () => {
    let state: RebuildState | null = {
      version: 2, phase: 'explore', step: 'menu', locale: 'en',
      booking: {
        pickupDate: '2026-12-08', returnDate: '2026-12-15',
        pickupLocation: 'Herzliya', returnLocation: 'Herzliya',
      },
      history: [{ from: 'bot', text: 'Which kind of car would you prefer?' }],
    };
    const store: RebuildStore = {
      isSimulation: true,
      loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null,
      createRentalRequest: async () => { throw new Error('handoff must not create a formal booking'); },
      readTurn: async () => null,
    };
    const send = (message: string) => getRebuiltBotReply('fictional-tourist', message, store);
    const family = await send('Could you note a family car as our preference?');
    expect(family.state.booking.vehicleNeed).toBe('family car');
    const party = await send('I am visiting with my partner and our two children.');
    expect(party.state.booking.passengers).toBe(4);
    const booster = await send('Is a booster seat possible for our older child? If so, please include that request. I am 38.');
    expect(booster.state.booking.childSeats).toBe(1);
    expect(booster.state.booking.childSeatType).toBe('booster');
    state = structuredClone(booster.state);
    state.history.push({ from: 'bot', text: 'Would you like to add any other additions?' });
    const final = await send('No other additions, thank you. My name is Alex Weber. My WhatsApp is 054-123-6789. Please pass these details to your team.');
    expect(final.state.handedOff).toBe(true);
    expect(final.escalate).toBe(true);
    expect(final.state.completedRental?.childSeatType).toBe('booster');
    expect(final.reply).toMatch(/family car|booster seat/i);
  });

  it('keeps selected English pickup and return dates in a combined polite message', async () => {
    let state: RebuildState | null = {
      version: 2, phase: 'explore', step: 'menu', locale: 'en', booking: { passengers: 4 },
      history: [{ from: 'bot', text: 'Would you like to check dates and pickup and return locations?' }],
    };
    const store: RebuildStore = {
      isSimulation: true,
      loadState: async () => state,
      saveState: async (_phone, next) => { state = structuredClone(next); },
      activeBooking: async () => null,
      createRentalRequest: async () => null,
      readTurn: async () => null,
    };
    const result = await getRebuiltBotReply('fictional-tourist', 'Yes. Could you note a family car as our preference? We would pick up in Herzliya on December 8 and return there on December 15. We will bring two medium suitcases and the stroller.', store);
    expect(result.state.booking).toMatchObject({
      vehicleNeed: 'family car', pickupDate: '2026-12-08', returnDate: '2026-12-15',
      pickupLocation: 'Herzliya', returnLocation: 'Herzliya', luggage: 2,
    });
  });
});
