import { BRANCHES as ALL_BRANCHES, mapsUrl, wazeUrl, type BranchId } from '@/lib/branches';
import { localeAlternates } from '@/lib/seo';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isHe = locale === 'he';
  return {
    title: { absolute: isHe ? 'סניפי SmartCar' : 'SmartCar Branches' },
    description: isHe
      ? 'סניפים בהרצליה, תל אביב, ירושלים ונתב"ג, ומסירה בתיאום מראש בכל הארץ.'
      : 'SmartCar has 4 branches across Israel: Herzliya, Tel Aviv, Jerusalem and Ben Gurion Airport. Visit us or book a car delivered straight to you.',
    alternates: localeAlternates(locale, 'branches'),
  };
}

// Address, phone and map links come from @/lib/branches (single source of
// truth). Only the page-specific presentation data — opening hours and the
// descriptive blurb — is defined here.
// Owner-confirmed 2026-07-28: every branch is 08:00–18:00. The site previously
// carried three different answers — 08:00–20:00 here and in contact, 08:00–18:00
// in the terms, and a fourth shape in the JSON-LD — so a customer could be told
// a different closing time depending on which page they landed on.
const WEEKDAY_HOURS: BranchHours = { weekdaysHe: 'א׳–ה׳', weekdaysEn: 'Sun–Thu', time: '08:00–18:00', fridayTime: null, saturday: false };

interface BranchHours {
  weekdaysHe: string;
  weekdaysEn: string;
  time: string;
  /** null when there is no separate Friday time to show. */
  fridayTime: string | null;
  saturday: boolean;
}

const BRANCH_DETAILS: Record<BranchId, { hours: BranchHours; descHe: string; descEn: string }> = {
  herzliya: {
    hours: WEEKDAY_HOURS,
    descHe: 'הסניף הראשי שלנו בהרצליה, ממוקם במלון דן אכדיה על קו החוף.',
    descEn: 'Our flagship location in Herzliya, situated at the iconic Dan Accadia Hotel directly on the seafront — easily accessible and open six days a week.',
  },
  telaviv: {
    hours: WEEKDAY_HOURS,
    descHe: 'סניף תל אביב במרכז העיר, קרוב לטיילת ולמלונות.',
    descEn: 'Centrally located in Tel Aviv, steps from the beachfront promenade and major hotels — the ideal starting point for exploring the city or heading out on the road.',
  },
  jerusalem: {
    hours: WEEKDAY_HOURS,
    descHe: 'סניף ירושלים ברחוב המלך דוד, לב ליבה של העיר.',
    descEn: 'Located on the prestigious King David Street in the heart of Jerusalem — perfectly positioned for business travellers and tourists alike.',
  },
  airport: {
    // Deliberately NOT changed to 08:00–18:00 with the other three. This entry
    // is a 24/7 DELIVERY service to the terminal, not a walk-in desk with
    // opening hours, and "מענה אנושי 24/7" is on the protected-claims list.
    // Collapsing it into branch hours would withdraw an approved claim and
    // mix up two different things — which is the confusion finding 37 is
    // about in the first place. Raised for the owner to confirm.
    hours: { weekdaysHe: '24/7', weekdaysEn: '24/7', time: '24/7', fridayTime: '24/7', saturday: true },
    descHe: 'שירות משלוח לנמל התעופה בן גוריון – זמין 24/7.',
    descEn: 'Arriving or departing from Ben Gurion Airport? We deliver your vehicle directly to the terminal — a seamless, 24/7 service so you can move the moment you land.',
  },
};

const BRANCHES = ALL_BRANCHES.map((b) => ({
  id: b.id,
  nameHe: b.nameHe,
  nameEn: b.nameEn,
  addressHe: `${b.streetHe}, ${b.cityHe}`,
  addressEn: `${b.streetEn}, ${b.cityEn}`,
  phone: b.phone,
  image: b.image,
  waze: wazeUrl(b),
  maps: mapsUrl(b),
  ...BRANCH_DETAILS[b.id],
}));

export default async function BranchesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isHe = locale === 'he';

  return (
    <div dir={isHe ? 'rtl' : 'ltr'} className="min-h-screen bg-gray-50">

      {/* Hero */}
      <div className="bg-[#0D2B2B] py-16 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">
          {isHe ? 'הסניפים שלנו' : 'Our Locations'}
        </h1>
        <p className="text-[#B8D8D8]">
          {isHe
            ? 'אפשר לאסוף ולהחזיר בסניפים או לתאם מסירה והחזרה בכתובות אחרות בארץ. השירות והמחיר נקבעים לפי הכתובת, השעה והזמינות.'
            : 'You can collect and return at our branches, or arrange delivery and return at other addresses in Israel. The service and price depend on the address, the time and availability.'}
        </p>
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {BRANCHES.map(branch => (
            <div key={branch.id} className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow flex flex-col">

              {/* Image */}
              <div className="relative h-52 overflow-hidden shrink-0">
                <Image
                  src={branch.image}
                  alt={isHe ? branch.nameHe : branch.nameEn}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <h2 className="absolute bottom-4 end-4 text-white text-xl font-bold drop-shadow">
                  <Link href={`/${locale}/branches/${branch.id}`} className="hover:underline">
                    {isHe ? branch.nameHe : branch.nameEn}
                  </Link>
                </h2>
              </div>

              {/* Info */}
              <div className="p-6 flex flex-col flex-1">
                <p className="text-gray-600 text-sm mb-5 text-start">
                  {isHe ? branch.descHe : branch.descEn}
                </p>

                {/* Address */}
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-[#B64916] mt-0.5 shrink-0">📍</span>
                  <p className="text-[#0D2B2B] font-medium text-sm">
                    {isHe ? branch.addressHe : branch.addressEn}
                  </p>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-gray-600 shrink-0">📞</span>
                  <a href={`tel:${branch.phone}`} className="text-[#B64916] font-bold hover:underline">
                    {branch.phone}
                  </a>
                </div>

                {/* Hours */}
                <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm">
                  <p className="font-bold text-[#0D2B2B] mb-2">
                    {isHe ? 'שעות פעילות' : 'Opening Hours'}
                  </p>
                  {branch.hours.time === '24/7' ? (
                    <p className="text-[#007A3D] font-semibold">24/7</p>
                  ) : (
                    <div className="space-y-1 text-gray-600">
                      <div className="flex justify-between">
                        <span>{branch.hours.time}</span>
                        <span>{isHe ? branch.hours.weekdaysHe : branch.hours.weekdaysEn}</span>
                      </div>
                      {branch.hours.fridayTime && (
                        <div className="flex justify-between">
                          <span>{branch.hours.fridayTime}</span>
                          <span>{isHe ? 'שישי' : 'Fri'}</span>
                        </div>
                      )}
                      {!branch.hours.saturday && (
                        <div className="flex justify-between">
                          <span className="text-[#C10007]">{isHe ? 'סגור' : 'Closed'}</span>
                          <span>{isHe ? 'שבת' : 'Sat'}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="mt-auto flex gap-2">
                  <a
                    href={branch.waze}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-[#007DAC] text-white py-3 rounded-xl text-center font-bold hover:bg-blue-500 transition-colors text-sm"
                  >
                    🧭 Waze
                  </a>
                  <a
                    href={branch.maps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-[#2D5F5F] text-white py-3 rounded-xl text-center font-bold hover:bg-[#1a3f3f] transition-colors text-sm"
                  >
                    🗺 {isHe ? 'מפות' : 'Maps'}
                  </a>
                  <a
                    href={`tel:${branch.phone}`}
                    className="flex-1 border-2 border-[#B64916] text-[#B64916] py-3 rounded-xl text-center font-bold hover:bg-orange-50 transition-colors text-sm"
                  >
                    📞 {isHe ? 'התקשר' : 'Call'}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
