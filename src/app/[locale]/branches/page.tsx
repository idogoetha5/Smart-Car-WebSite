import type { Metadata } from 'next';
import Image from 'next/image';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isHe = locale === 'he';
  return {
    title: isHe ? 'סניפים' : 'Branches',
    description: isHe
      ? 'ל-SmartCar 4 סניפים ברחבי ישראל: הרצליה, תל אביב, ירושלים ונמל התעופה בן גוריון. הגיעו אלינו או הזמינו רכב שיגיע עד אליכם בכל מקום.'
      : 'SmartCar has 4 branches across Israel: Herzliya, Tel Aviv, Jerusalem and Ben Gurion Airport. Visit us or book a car delivered straight to you.',
    alternates: { canonical: `/${locale}/branches` },
  };
}

const BRANCHES = [
  {
    id: 'herzliya',
    nameHe: 'סניף הרצליה',
    nameEn: 'Herzliya',
    addressHe: 'רחוב רמת ים 122 (מלון דן אכדיה), הרצליה',
    addressEn: '122 Ramat Yam St (Dan Accadia Hotel), Herzliya',
    phone: '09-9509757',
    hours: { weekdaysHe: 'א׳–ה׳', weekdaysEn: 'Sun–Thu', time: '08:00–20:00', fridayTime: '08:00–14:00', saturday: false },
    image: '/images/branch-herzliya.webp',
    waze: 'https://waze.com/ul?q=רמת ים 122, הרצליה&navigate=yes',
    maps: 'https://maps.google.com/?q=רמת+ים+122,+הרצליה',
    descHe: 'הסניף הראשי שלנו בהרצליה, ממוקם במלון דן אכדיה על קו החוף.',
    descEn: 'Our flagship location in Herzliya, situated at the iconic Dan Accadia Hotel directly on the seafront — easily accessible and open six days a week.',
  },
  {
    id: 'telaviv',
    nameHe: 'סניף תל אביב',
    nameEn: 'Tel Aviv',
    addressHe: 'מאפו 2 פינת הירקון 112, תל אביב',
    addressEn: '2 Mapu St, corner of 112 Hayarkon, Tel Aviv',
    phone: '03-5233073',
    hours: { weekdaysHe: 'א׳–ה׳', weekdaysEn: 'Sun–Thu', time: '08:00–20:00', fridayTime: '08:00–14:00', saturday: false },
    image: '/images/branch-telaviv.webp',
    waze: 'https://waze.com/ul?q=הירקון 112, תל אביב&navigate=yes',
    maps: 'https://maps.google.com/?q=הירקון+112,+תל+אביב',
    descHe: 'סניף תל אביב במרכז העיר, קרוב לטיילת ולמלונות.',
    descEn: 'Centrally located in Tel Aviv, steps from the beachfront promenade and major hotels — the ideal starting point for exploring the city or heading out on the road.',
  },
  {
    id: 'jerusalem',
    nameHe: 'סניף ירושלים',
    nameEn: 'Jerusalem',
    addressHe: 'המלך דוד 8, ירושלים',
    addressEn: '8 King David St, Jerusalem',
    phone: '02-6221150',
    hours: { weekdaysHe: 'א׳–ה׳', weekdaysEn: 'Sun–Thu', time: '08:00–20:00', fridayTime: '08:00–14:00', saturday: false },
    image: '/images/branch-jerusalem.webp',
    waze: 'https://waze.com/ul?q=המלך דוד 8, ירושלים&navigate=yes',
    maps: 'https://maps.google.com/?q=המלך+דוד+8,+ירושלים',
    descHe: 'סניף ירושלים ברחוב המלך דוד, לב ליבה של העיר.',
    descEn: 'Located on the prestigious King David Street in the heart of Jerusalem — perfectly positioned for business travellers and tourists alike.',
  },
  {
    id: 'airport',
    nameHe: 'נתב"ג – שירות משלוח',
    nameEn: 'Ben Gurion Airport',
    addressHe: 'נמל התעופה בן גוריון',
    addressEn: 'Ben Gurion International Airport',
    phone: '09-9509757',
    hours: { weekdaysHe: '24/7', weekdaysEn: '24/7', time: '24/7', fridayTime: '24/7', saturday: true },
    image: '/images/branch-airport.webp',
    waze: 'https://waze.com/ul?q=נמל התעופה בן גוריון, לוד&navigate=yes',
    maps: 'https://maps.google.com/?q=נמל+התעופה+בן+גוריון,+לוד',
    descHe: 'שירות משלוח לנמל התעופה בן גוריון – זמין 24/7.',
    descEn: 'Arriving or departing from Ben Gurion Airport? We deliver your vehicle directly to the terminal — a seamless, 24/7 service so you can move the moment you land.',
  },
];

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
          {isHe ? '4 סניפים ברחבי הארץ לשירותכם' : 'Four convenient locations across Israel — ready to serve you'}
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
                  {isHe ? branch.nameHe : branch.nameEn}
                </h2>
              </div>

              {/* Info */}
              <div className="p-6 flex flex-col flex-1">
                <p className="text-gray-500 text-sm mb-5 text-start">
                  {isHe ? branch.descHe : branch.descEn}
                </p>

                {/* Address */}
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-[#E8743B] mt-0.5 shrink-0">📍</span>
                  <p className="text-[#0D2B2B] font-medium text-sm">
                    {isHe ? branch.addressHe : branch.addressEn}
                  </p>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-gray-400 shrink-0">📞</span>
                  <a href={`tel:${branch.phone}`} className="text-[#E8743B] font-bold hover:underline">
                    {branch.phone}
                  </a>
                </div>

                {/* Hours */}
                <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm">
                  <p className="font-bold text-[#0D2B2B] mb-2">
                    {isHe ? 'שעות פעילות' : 'Opening Hours'}
                  </p>
                  {branch.hours.time === '24/7' ? (
                    <p className="text-green-600 font-semibold">24/7</p>
                  ) : (
                    <div className="space-y-1 text-gray-600">
                      <div className="flex justify-between">
                        <span>{branch.hours.time}</span>
                        <span>{isHe ? branch.hours.weekdaysHe : branch.hours.weekdaysEn}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{branch.hours.fridayTime}</span>
                        <span>{isHe ? 'שישי' : 'Fri'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-red-500">{isHe ? 'סגור' : 'Closed'}</span>
                        <span>{isHe ? 'שבת' : 'Sat'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="mt-auto flex gap-2">
                  <a
                    href={branch.waze}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-[#00ADEF] text-white py-3 rounded-xl text-center font-bold hover:bg-blue-500 transition-colors text-sm"
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
                    className="flex-1 border-2 border-[#E8743B] text-[#E8743B] py-3 rounded-xl text-center font-bold hover:bg-orange-50 transition-colors text-sm"
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
