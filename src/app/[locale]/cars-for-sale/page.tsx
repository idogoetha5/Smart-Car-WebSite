export const revalidate = 60;

import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isHe = locale === 'he';
  return {
    title: isHe ? 'רכבים למכירה' : 'Cars for Sale',
    description: isHe
      ? 'רכבים יד שנייה למכירה ב-SmartCar – מגוון דגמים במצב מעולה, מחירים הוגנים ושקיפות מלאה. מצאו את הרכב הבא שלכם ופנו אלינו עוד היום.'
      : 'Used cars for sale at SmartCar – a variety of models in excellent condition, fair prices and full transparency. Find your next car and contact us today.',
    alternates: { canonical: `/${locale}/cars-for-sale` },
  };
}

import { createClient } from '@/lib/supabase/server';
import { Car, Phone } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import Tilt3D from '@/components/ui/Tilt3D';

interface CarForSale {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  km: number | null;
  color: string | null;
  extras: string | null;
  image_url: string | null;
  created_at: string;
}

async function getCarsForSale(): Promise<CarForSale[]> {
  try {
    const { createClient: createAdmin } = await import('@supabase/supabase-js');
    const supabase = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data } = await supabase
      .from('cars_for_sale')
      .select('*')
      .order('created_at', { ascending: false });
    return data ?? [];
  } catch {
    return [];
  }
}

export default async function CarsForSalePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isHe = locale === 'he';
  const cars = await getCarsForSale();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mb-10">
        <div className="flex items-center gap-2 text-[#E8743B] mb-3">
          <Car className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">
            {isHe ? 'מכירת רכב' : 'Cars for Sale'}
          </span>
        </div>
        <h1 className="text-4xl font-black text-gray-900 mb-3">
          {isHe ? 'רכבים למכירה' : 'Cars for Sale'}
        </h1>
        <p className="text-gray-500 text-lg">
          {isHe
            ? 'רכבים איכותיים במחירים הוגנים – ישירות מהצי שלנו'
            : 'Quality vehicles at fair prices – directly from our fleet'}
        </p>
      </div>

      {cars.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg viewBox="0 0 80 48" fill="none" className="w-28 h-20 text-[#2D5F5F] mb-6 opacity-25" aria-hidden="true">
            <rect x="4" y="16" width="72" height="22" rx="4" fill="currentColor"/>
            <path d="M10 16 L20 4 L60 4 L70 16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round"/>
            <circle cx="20" cy="38" r="6" fill="currentColor"/>
            <circle cx="60" cy="38" r="6" fill="currentColor"/>
          </svg>
          <p className="text-gray-700 text-2xl font-bold mb-2">
            {isHe ? 'אין רכבים למכירה כרגע' : 'No cars for sale at the moment'}
          </p>
          <p className="text-gray-400 mb-8 text-lg">
            {isHe
              ? 'השאירו פרטים ונעדכן אתכם ברגע שיתפנה רכב'
              : 'Leave your details and we\'ll notify you as soon as a car becomes available'}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href={`https://wa.me/97299509757?text=${encodeURIComponent(isHe ? 'שלום, אני מעוניין לקנות רכב מהצי שלכם. אנא עדכנו אותי כשיהיו רכבים למכירה.' : 'Hello, I\'m interested in buying a car from your fleet. Please notify me when cars become available.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#1ebe5d] transition-colors text-lg"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {isHe ? 'עדכנו אותי בוואטסאפ' : 'Notify me on WhatsApp'}
            </a>
            <a
              href="tel:09-9509757"
              className="flex items-center gap-2 px-6 py-3 bg-[#0D2B2B] text-white font-bold rounded-xl hover:bg-[#1A3A3A] transition-colors text-lg"
            >
              {isHe ? 'התקשר: 09-9509757' : 'Call: 09-9509757'}
            </a>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {cars.map((car) => (
            <div
              key={car.id}
              className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-shadow duration-300 border border-gray-100 overflow-hidden group"
            >
              <div className="relative h-52 bg-[#eef6f6] overflow-hidden">
                {car.image_url ? (
                  <Tilt3D>
                    <Image
                      src={car.image_url}
                      alt={`${car.make} ${car.model}`}
                      fill
                      className="object-contain p-2 scale-[0.3]"
                    />
                  </Tilt3D>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg viewBox="0 0 80 48" fill="none" className="w-28 h-20 text-[#2D5F5F]" aria-hidden="true">
                      <rect x="4" y="16" width="72" height="22" rx="4" fill="currentColor" opacity="0.15"/>
                      <path d="M10 16 L20 4 L60 4 L70 16" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round"/>
                      <circle cx="20" cy="38" r="6" fill="currentColor"/>
                      <circle cx="60" cy="38" r="6" fill="currentColor"/>
                    </svg>
                  </div>
                )}
                <div className="absolute top-3 start-3">
                  <span className="px-3 py-1 bg-[#E8743B] text-white text-xs font-bold rounded-full">
                    {isHe ? 'למכירה' : 'For Sale'}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <h3 className="font-bold text-xl text-gray-900 mb-1">
                  {car.year} {car.make} {car.model}
                </h3>

                <div className="flex flex-wrap gap-3 mb-4 text-sm text-gray-500">
                  {car.km !== null && (
                    <span className="flex items-center gap-1">
                      🛣️ {car.km.toLocaleString()} {isHe ? 'ק"מ' : 'km'}
                    </span>
                  )}
                  {car.color && (
                    <span className="flex items-center gap-1">
                      🎨 {car.color}
                    </span>
                  )}
                </div>

                {car.extras && (
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{car.extras}</p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <p className="text-2xl font-black text-[#2D5F5F]">
                    ₪{car.price.toLocaleString()}
                  </p>
                  <a
                    href="tel:09-9509757"
                    className="flex items-center gap-2 px-4 py-2 bg-[#2D5F5F] text-white text-sm font-bold rounded-xl hover:bg-[#1A3A3A] transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    {isHe ? 'התקשר' : 'Call'}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-16 p-8 bg-[#0D2B2B] rounded-2xl text-center text-white">
        <h2 className="text-2xl font-bold mb-2">
          {isHe ? 'מעוניין לקנות?' : 'Interested in buying?'}
        </h2>
        <p className="text-[#B8D8D8] mb-6">
          {isHe
            ? 'צרו איתנו קשר ונשמח לעזור לכם למצוא את הרכב המתאים'
            : 'Contact us and we\'ll help you find the right car'}
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="tel:09-9509757"
            className="px-6 py-3 bg-[#E8743B] text-white font-bold rounded-xl hover:bg-[#d4622a] transition-colors"
          >
            📞 09-9509757
          </a>
          <Link
            href={`/${locale}/contact`}
            className="px-6 py-3 border-2 border-white text-white font-bold rounded-xl hover:bg-white/10 transition-colors"
          >
            {isHe ? 'השאר פרטים' : 'Leave details'}
          </Link>
        </div>
      </div>
    </div>
  );
}
