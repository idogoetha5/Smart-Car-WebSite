import { getWhatsAppRentalQuotes } from './whatsapp-rental-quotes';
import type { FlowState } from './whatsapp-flow';
import { renderRentalQuotePdf } from './rental-quote-server';
import { createRentalQuoteLink, rentalQuoteLinkExpiry, rentalQuoteShortLink } from './quote-link';
import { createAdminClient } from './supabase/server';
import type { RentalQuoteData } from './rental-quote';

export async function generateWhatsAppPdfQuoteLink(state: FlowState, locale: 'en' | 'he', baseUrl: string): Promise<string | null> {
  try {
    if (!state.pickupDate || !state.dropoffDate || !state.pickupLocation || !state.dropoffLocation) return null;
    const quotes = await getWhatsAppRentalQuotes(state.vehiclePreference, state.pickupDate, state.dropoffDate);
    if (!quotes.length) return null;

    const selectedQuote = quotes[0];
    
    // Calculate days based on dates
    const pickup = new Date(`${state.pickupDate}T00:00:00Z`);
    const dropoff = new Date(`${state.dropoffDate}T00:00:00Z`);
    const diffTime = Math.abs(dropoff.getTime() - pickup.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    const data: RentalQuoteData = {
      quoteNumber: `WA-${Math.floor(Math.random() * 100000)}`,
      date: new Date().toISOString(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      locale: locale,
      documentMode: 'quote',
      customerName: state.customerName || 'לקוח יקר',
      customerPhone: '',
      customerEmail: state.customerEmail || '',
      pickupDate: state.pickupDate,
      returnDate: state.dropoffDate,
      pickupTime: state.pickupTime || '09:00',
      returnTime: state.returnTime || '09:00',
      pickupLocation: state.pickupLocation,
      returnLocation: state.dropoffLocation,
      vehicles: [{
        name: selectedQuote.title,
        year: new Date().getFullYear().toString(),
        category: state.vehiclePreference || 'Standard',
        imageUrl: '',
        dailyPrice: selectedQuote.pricePerDay,
        quantity: 1,
      }],
      extras: [],
      deliveryFee: 0,
      discount: 0,
      vatMode: 'included',
      mileageAllowance: '200',
      notes: 'הצעת מחיר אוטומטית מוואטסאפ (לא אישור סופי)',
      insuranceCoverage: 'ביטוח מקיף מלא (CDW & TP)',
      deposit: '₪2000 - מסגרת אשראי',
      deductible: '₪1500 + מע"מ',
      fuelPolicy: 'פול טו פול'
    };

    const pdfBuffer = await renderRentalQuotePdf(data);
    
    const expiresAt = rentalQuoteLinkExpiry(data.validUntil);
    const { token, storagePath } = createRentalQuoteLink(
      data.quoteNumber,
      data.documentMode,
      expiresAt
    );

    const supabase = createAdminClient();
    const { error: uploadError } = await supabase.storage
      .from('quote-pdfs')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
        cacheControl: '3600',
      });
      
    if (uploadError) {
      console.error('[whatsapp-pdf] Upload error:', uploadError);
      return null;
    }

    return rentalQuoteShortLink(baseUrl, token);
  } catch (err) {
    console.error('[whatsapp-pdf] Generation error:', err);
    return null;
  }
}
