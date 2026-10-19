import { NextResponse } from 'next/server';
import { sendClosingNotices } from '@/lib/whatsapp-closing';

export const runtime = 'nodejs';

/**
 * Tells customers, half an hour before the bot forgets their WhatsApp
 * conversation (12 hours after their last message), that the chat is about
 * to close. Called every 10 minutes by .github/workflows/whatsapp-closing.yml
 * with `Authorization: Bearer $CRON_SECRET`; everything else is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await sendClosingNotices());
  } catch (error) {
    console.error('[whatsapp-closing]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Closing notices failed' }, { status: 500 });
  }
}
