import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/admin-auth';
import type { RentalQuoteData } from '@/lib/rental-quote';
import { renderRentalQuotePdf } from '@/lib/rental-quote-server';
import { validRentalQuoteData } from '@/lib/rental-quote-validation';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = (await request.json().catch(() => null)) as RentalQuoteData | null;
  if (!validRentalQuoteData(data)) {
    return NextResponse.json(
      { error: 'יש למלא לקוח, טלפון, תאריכים, מיקומים ולפחות רכב אחד' },
      { status: 400 }
    );
  }

  try {
    const pdf = await renderRentalQuotePdf(data);
    const kind =
      data.documentMode === 'confirmation'
        ? 'SmartCar_Booking_Confirmation'
        : 'SmartCar_Rental_Quote';
    const utf8Name = encodeURIComponent(`${kind}_${data.customerName}.pdf`);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${kind}.pdf"; filename*=UTF-8''${utf8Name}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[rental-quote-pdf] render failed:', (error as Error)?.message);
    return NextResponse.json({ error: 'יצירת ה-PDF נכשלה' }, { status: 500 });
  }
}
