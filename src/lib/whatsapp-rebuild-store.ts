import { createAdminClient } from '@/lib/supabase/server';
import { normalizeWhatsAppPhone } from '@/lib/rental-quote';
import { termsConsent } from '@/lib/consent';
import type { RebuildState, RebuildStore } from '@/lib/whatsapp-rebuild';

async function activeBooking(phone: string) {
  const canonical = normalizeWhatsAppPhone(phone);
  if (!canonical) return null;
  const { data, error } = await createAdminClient().from('bookings')
    .select('id, status, pickup_date, dropoff_date, pickup_location, dropoff_location, customer_phone')
    .eq('customer_phone_normalized', canonical)
    .in('status', ['PENDING', 'CONFIRMED', 'ACTIVE'])
    .order('pickup_date', { ascending: true }).limit(20);
  if (error) throw new Error(`[whatsapp-rebuild] booking lookup failed: ${error.message}`);
  const rows = (data ?? []).filter(row => normalizeWhatsAppPhone(row.customer_phone) === canonical);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
  return rows.find(row => row.dropoff_date >= today) ?? null;
}

async function loadState(phone: string): Promise<RebuildState | null> {
  const { data, error } = await createAdminClient().from('whatsapp_conversation_states')
    .select('state').eq('phone', phone).maybeSingle();
  if (error) throw new Error(`[whatsapp-rebuild] state load failed: ${error.message}`);
  const state = data?.state as RebuildState | null;
  return state?.version === 2 && ['he', 'en'].includes(state.locale) && Array.isArray(state.history) ? state : null;
}

async function saveState(phone: string, state: RebuildState): Promise<void> {
  const { error } = await createAdminClient().from('whatsapp_conversation_states')
    .upsert({ phone, state, updated_at: new Date().toISOString() });
  if (error) throw new Error(`[whatsapp-rebuild] state save failed: ${error.message}`);
}

async function createRentalRequest(phone: string, state: RebuildState): Promise<string | null> {
  const b = state.booking;
  if (!b.pickupDate || !b.returnDate || !b.pickupLocation || !b.returnLocation || !b.vehicleNeed || !b.customerName || !b.customerEmail) return null;
  const consent = termsConsent(state.locale);
  const { data, error } = await createAdminClient().from('whatsapp_rental_requests').insert({
    phone: normalizeWhatsAppPhone(phone), customer_name: b.customerName, customer_email: b.customerEmail,
    pickup_date: b.pickupDate, dropoff_date: b.returnDate,
    pickup_time: '09:00', return_time: '09:00',
    pickup_location: b.pickupLocation, dropoff_location: b.returnLocation,
    vehicle_preference: b.vehicleNeed,
    trip_needs: [b.passengers && `${b.passengers} passengers`, b.luggage && `${b.luggage} luggage`, b.childSeats && `${b.childSeats} child seats`, 'times not given — coordinate with customer'].filter(Boolean).join(', '),
    locale: state.locale, status: 'PENDING', terms_version: consent.version,
    terms_text_hash: consent.hash, terms_accepted_at: new Date().toISOString(), consent_source: 'whatsapp',
  }).select('id').single();
  if (error || !data?.id) {
    console.error('[whatsapp-rebuild] rental request creation failed', error?.message ?? 'missing id');
    return null;
  }
  return String(data.id);
}

export const persistentRebuildStore: RebuildStore = { activeBooking, loadState, saveState, createRentalRequest };
