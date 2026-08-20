import { NextResponse } from 'next/server';
import { getCarsForSale } from '@/lib/cars-for-sale';

export async function GET() {
  try {
    return NextResponse.json({ data: await getCarsForSale() });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'שגיאת שרת, נסה שוב' }, { status: 500 });
  }
}
