import { localeAlternates } from '@/lib/seo';
export const revalidate = 3600;

import { notFound } from 'next/navigation';
import { getVehicleById } from '@/lib/db/vehicles';
import BookingForm from '@/components/booking/BookingForm';
import VehicleGallery from '@/components/vehicle/VehicleGallery';
import BackToVehicles from '@/components/vehicle/BackToVehicles';
import { Users, DoorOpen, Settings, Fuel } from 'lucide-react';
import { WHATSAPP_NUMBER } from '@/lib/constants';

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

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: locale === 'he' ? 'ראשי' : 'Home', item: `${baseUrl}/${locale}` },
      { '@type': 'ListItem', position: 2, name: locale === 'he' ? 'צי הרכבים' : 'Vehicle Catalog', item: `${baseUrl}/${locale}/catalog` },
      { '@type': 'ListItem', position: 3, name: `${vehicle.year} ${vehicle.make} ${vehicle.model}`, item: `${baseUrl}/${locale}/rental/${vehicle.id}` },
    ],
  };

  return (
    // Extra top padding, not the usual py-10: this page hides the site header,
    // so the floating accessibility button sits at the very top left. Between
    // md and lg the container has no side gutter to speak of, and in English
    // the back link starts at that same left edge — at py-10 the two landed on
    // each other. Starting the content at 5rem clears the button in both
    // directions, and looks better on a page with no header above it.
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10 overflow-x-hidden" dir={locale === 'he' ? 'rtl' : 'ltr'}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(vehicleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c') }} />

      {/* First thing on the page — no hero here, the customer is mid-flow
          and needs the way back to the listing they came from. */}
      <BackToVehicles locale={locale} />

      <div className="grid lg:grid-cols-2 gap-12">
        {/* Vehicle Info — shown below form on mobile, beside it on desktop.
            Desktop order is deliberately locale-conditional, not just
            "order-1": `order` places items along the grid's own reading
            direction, so a fixed order-1/order-2 pair renders mirrored
            between rtl and ltr. We want the photo on the physical left and
            the form on the physical right in both languages, so Hebrew
            gets the swapped order values needed to land there too. */}
        <div className={`order-2 ${locale === 'he' ? 'lg:order-2' : 'lg:order-1'}`}>
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
        <div className={`order-1 ${locale === 'he' ? 'lg:order-1' : 'lg:order-2'}`}>
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
            {/* The floating WhatsApp button is hidden on this route (it ends up
                covering form fields on mobile — see hidesFloatingWhatsApp), so
                this is the only WhatsApp contact left on the page; it must stay. */}
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                locale === 'he'
                  ? `שלום, אשמח לעזרה לגבי ${vehicle.make} ${vehicle.model}`
                  : `Hi, I'd like help with the ${vehicle.make} ${vehicle.model}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-[#25D366] hover:underline mb-4 -mt-3"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              {locale === 'he' ? 'או שאלו אותנו בוואטסאפ' : 'Or ask us on WhatsApp'}
            </a>
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
