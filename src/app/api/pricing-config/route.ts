import { NextResponse } from 'next/server';
import { getActiveSeasons, getAllOverrides } from '@/lib/db/pricing';
import type { PricingConfig } from '@/lib/seasonal';

export async function GET() {
  try {
    const [seasons, overrides] = await Promise.all([getActiveSeasons(), getAllOverrides()]);
    const data: PricingConfig = { seasons, overrides };
    return NextResponse.json({ data });
  } catch (error) {
    console.error((error as Error).message);
    return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 });
  }
}
