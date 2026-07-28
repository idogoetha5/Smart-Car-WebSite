import { localeAlternates } from '@/lib/seo';
export const revalidate = 60;

import { notFound } from 'next/navigation';
import { getVehicleById } from '@/lib/db/vehicles';
import BookingForm from '@/components/booking/BookingForm';
import VehicleGallery from '@/components/vehicle/VehicleGallery';
import BackToVehicles from '@/components/vehicle/BackToVehicles';
import { Users, DoorOpen, Settings, Fuel } from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const vehicle = await getVehicleById(id).catch(() => null);
  if (!vehicle) return {};
  const isHe = locale === 'he';
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const description = (isHe ? vehicle.descriptionHe : vehicle.descriptionEn) ??
    (isHe
      ? `${vehicle.make} ${vehicle.model} — מ-₪${vehicle.pricePerDay}/יום`
      : `${vehicle.make} ${vehicle.model} — from ₪${vehicle.pricePerDay}/day`);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://smartcar.co.il';
  const pageUrl = `${baseUrl}/${locale}/rental/${vehicle.id}`;
  const image = vehicle.imageUrls?.[0] ?? null;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: 'SmartCar',
      locale: isHe ? 'he_IL' : 'en_US',
      type: 'website',
      ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: title }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    alternates: localeAlternates(locale, `rental/${vehicle.id}`),
  };
}

export default async function RentalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;

  let vehicle = null;
  try {
    vehicle = await getVehicleById(id);
  } catch {}

  // A real 404, not a 200 page that says "not found". Returning markup with a
  // 200 let search engines index every non-existent vehicle URL as a valid
  // page, inflated ad metrics, and left the visitor at a dead end. notFound()
  // renders the locale 404, which offers a route back to the fleet.
  if (!vehicle) {
    notFound();
  }

  const description =
    locale === 'he' ? vehicle.descriptionHe : vehicle.descriptionEn;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://smartcar.co.il';
  const vehicleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    description: description ?? `${vehicle.make} ${vehicle.model} ${vehicle.year}`,
    image: vehicle.imageUrls?.[0] ?? undefined,
    brand: { '@type': 'Brand', name: vehicle.make },
    offers: {
      '@type': 'Offer',
      price: vehicle.pricePerDay,
      priceCurrency: 'ILS',
      priceSpecification: { '@type': 'UnitPriceSpecification', price: vehicle.pricePerDay, priceCurrency: 'ILS', unitText: 'DAY' },
      url: `${baseUrl}/${locale}/rental/${vehicle.id}`,
      seller: { '@type': 'AutoRental', name: 'SmartCar' },
    },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 overflow-x-hidden" dir={locale === 'he' ? 'rtl' : 'ltr'}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(vehicleJsonLd) }} />

      {/* First thing on the page — no hero here, the customer is mid-flow
          and needs the way back to the listing they came from. */}
      <BackToVehicles locale={locale} />

      <div className="grid lg:grid-cols-2 gap-12">
        {/* Vehicle Info — shown below form on mobile, beside it on desktop */}
        <div className="order-2 lg:order-1">
          <VehicleGallery
            images={vehicle.imageUrls ?? []}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          />

          {/* The confirmation applies to the vehicle group or the model
              named in writing, not necessarily the car photographed. */}
          <p className="text-xs text-gray-500 mt-2 mb-4">
            {locale === 'he'
              ? 'התמונה להמחשה. האישור הסופי הוא לקבוצת הרכב או לדגם שיצוין בכתב.'
              : 'Image for illustration. Final confirmation applies to the vehicle group or model confirmed in writing.'}
          </p>

          <h1 className="text-3xl font-black text-gray-900 mb-2">
            {vehicle.make} {vehicle.model}
          </h1>

          <div className="flex flex-wrap gap-4 my-5 text-sm text-gray-600">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#2D5F5F]" />
              <span>{vehicle.seats} {locale === 'he' ? 'מושבים' : 'seats'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <DoorOpen className="w-4 h-4 text-[#2D5F5F]" />
              <span>{vehicle.doors} {locale === 'he' ? 'דלתות' : 'doors'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-[#2D5F5F]" />
              <span>{vehicle.transmission === 'AUTOMATIC' ? (locale === 'he' ? 'אוטומטי' : 'Automatic') : (locale === 'he' ? 'ידני' : 'Manual')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Fuel className="w-4 h-4 text-[#2D5F5F]" />
              <span>{
                vehicle.fuelType === 'GASOLINE' ? (locale === 'he' ? 'בנזין'   : 'Gasoline') :
                vehicle.fuelType === 'DIESEL'   ? (locale === 'he' ? 'דיזל'    : 'Diesel')   :
                vehicle.fuelType === 'ELECTRIC' ? (locale === 'he' ? 'חשמלי'   : 'Electric') :
                vehicle.fuelType === 'HYBRID'   ? (locale === 'he' ? 'היברידי' : 'Hybrid')   :
                vehicle.fuelType
              }</span>
            </div>
          </div>

          {description && (
            <p className="text-gray-600 leading-relaxed mb-6">{description}</p>
          )}

          {vehicle.features?.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">
                {locale === 'he' ? 'ציוד ואביזרים' : 'Features'}
              </h3>
              <div className="flex flex-wrap gap-2">
                {vehicle.features.map((f) => (
                  <span
                    key={f}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Booking Form — shown first on mobile, beside vehicle info on desktop */}
        <div className="order-1 lg:order-2">
          {/* The form is always shown. The online catalogue holds only part
              of the fleet, so it cannot conclude that no vehicle exists —
              the previous "הרכב תפוס" panel replaced the form with a dead
              end and left the customer no way to ask. Staff check the full
              fleet and confirm in writing. */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              {/* Name comes from the loaded vehicle record, so the heading
                  always matches the car actually being requested. */}
              {locale === 'he'
                ? `הזמנת רכב – ${vehicle.make} ${vehicle.model}`
                : `Vehicle booking – ${vehicle.make} ${vehicle.model}`}
            </h2>
            <BookingForm
              vehicle={vehicle}
              initialPickupDate={sp.pickup ?? ''}
              initialReturnDate={sp.return ?? ''}
              initialLocation={sp.pickupLocation ?? sp.location ?? ''}
              initialReturnLocation={sp.returnLocation ?? sp.pickupLocation ?? sp.location ?? ''}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
