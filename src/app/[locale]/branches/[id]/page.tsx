import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRANCHES, mapsUrl, wazeUrl, type BranchId } from '@/lib/branches';
import { localeAlternates } from '@/lib/seo';

export function generateStaticParams() {
  return BRANCHES.map((b) => ({ id: b.id }));
}

// What people actually search for is not always the branch's municipal
// address — Ben Gurion Airport's postal address is technically in Lod, but
// nobody searches "car rental in Lod" for it. This is the SEO-facing name
// used in the title, H1 and alt text; the real municipal city still goes
// into the JSON-LD postal address below.
const DISPLAY_CITY: Record<BranchId, { he: string; en: string }> = {
  herzliya: { he: 'הרצליה', en: 'Herzliya' },
  telaviv: { he: 'תל אביב', en: 'Tel Aviv' },
  jerusalem: { he: 'ירושלים', en: 'Jerusalem' },
  airport: { he: 'נתב"ג', en: 'Ben Gurion Airport' },
};

// Longer, city-specific SEO copy for each branch's own page. Deliberately
// separate from the one-line descHe/descEn on the /branches grid (kept
// unchanged there) — this is the dedicated landing-page content Google can
// rank for "השכרת רכב <city>" searches, one URL per city.
const CONTENT: Record<BranchId, { metaHe: string; metaEn: string; bodyHe: string; bodyEn: string }> = {
  herzliya: {
    metaHe: 'השכרת רכב בהרצליה ליד מלון דן אכדיה, על קו החוף — לתושבים, אנשי עסקים מהרצליה פיתוח ותיירים כאחד.',
    metaEn: 'Car rental in Herzliya by the Dan Accadia Hotel on the seafront — for residents, Herzliya Pituach business visitors and tourists alike.',
    bodyHe:
      'השכרת רכב בהרצליה מתאימה לכל מי שנמצא באזור — לא רק לאורחי המלון. תושבי הרצליה והשרון שצריכים רכב לכמה ימים, עובדי הייטק שמגיעים לפגישות בהרצליה פיתוח, משפחות שיוצאות לחוף, ותיירים שמתארחים בסביבה — כולם מוזמנים. הסניף הראשי שלנו יושב במלון דן אכדיה, על קו החוף, קרוב לכביש החוף (2) ולכביש 6, כך שיציאה לכל כיוון בארץ פשוטה. אצלנו תמצאו את כל הצי: מקומפקטי ועד יוקרה, עם השירות האישי שמלווה את SmartCar כבר משנת 2003.',
    bodyEn:
      'Car rental in Herzliya isn\'t just for hotel guests. Local residents who need a car for a few days, hi-tech professionals visiting Herzliya Pituach for meetings, families heading to the beach, and tourists staying in the area are all welcome. Our flagship branch sits at the Dan Accadia Hotel on the seafront, close to the coastal highway (Route 2) and Route 6 — an easy launch point to anywhere in the country. Our fleet spans compact to luxury, backed by the personal service SmartCar has offered since 2003.',
  },
  telaviv: {
    metaHe: 'השכרת רכב בתל אביב במרכז העיר, קרוב לטיילת — לתושבים, אנשי עסקים ותיירים.',
    metaEn: 'Car rental in Tel Aviv, centrally located near the beachfront — for residents, business travelers and tourists.',
    bodyHe:
      'תל אביב היא עיר שלא תמיד נוח לנהוג בה ברכב שלא מכירים: חניה בכחול-לבן מחולקת למתחמים, ועומסים בשעות השיא. הסניף שלנו במרכז העיר, קרוב לטיילת ולמלונות, משרת תושבי תל אביב שצריכים רכב זמני, אנשי עסקים שמגיעים למגדלי המשרדים במרכז, ותיירים שרוצים לגלות את החוף ואת שאר הארץ. משם היציאה לאיילון ולכל הכיוונים מהירה, ואצלנו תמצאו רכב מתאים לכל צורך — מקומפקטי, משפחתי ואפילו יוקרה.',
    bodyEn:
      'Tel Aviv isn\'t always easy to drive in if you don\'t know it: blue-and-white parking zones are divided by district, and traffic builds up fast at peak hours. Our branch in the city center, near the beach promenade and major hotels, serves Tel Aviv residents who need a car short-term, business travelers heading to the office towers downtown, and tourists exploring the beach and beyond. From here it\'s a quick run onto the Ayalon and out in any direction, with a fleet ranging from compact to family to luxury.',
  },
  jerusalem: {
    metaHe: 'השכרת רכב בירושלים ברחוב המלך דוד, סמוך לממילא — לתושבים, אנשי עסקים, תיירים וסטודנטים.',
    metaEn: 'Car rental in Jerusalem on King David Street, near Mamilla — for residents, business visitors, tourists and students.',
    bodyHe:
      'נהיגה בעיר העתיקה ובסמטאות מרכז ירושלים לא פשוטה, ולכן הסניף שלנו ברחוב המלך דוד, סמוך למתחם ממילא, יושב במיקום שממנו קל לצאת לכביש 1 ולכבישים הראשיים בלי להיכנס לפקקים של מרכז העיר. השכרת רכב בירושלים מתאימה לתושבי העיר, לאנשי עסקים שמגיעים למרכז ולמוסדות הממשל, לתיירים ולעולי-רגל שרוצים לצאת ממנה לים המלח, לצפון או לכל מקום אחר בארץ, ולסטודנטים שצריכים רכב לתקופה קצרה. גם כאן תמצאו את הצי הרחב והשירות האישי שמאפיינים כל סניף של SmartCar.',
    bodyEn:
      'Driving through the Old City and downtown Jerusalem\'s narrow streets isn\'t simple, which is why our branch on King David Street, near the Mamilla complex, sits somewhere you can reach Route 1 and the main highways without fighting the city-center traffic. Car rental in Jerusalem works for city residents, business visitors heading to the government and institutional district, tourists and pilgrims continuing on to the Dead Sea or the north, and students who need a car for a short stretch. The same wide fleet and personal service you\'ll find at every SmartCar branch is here too.',
  },
  airport: {
    metaHe: 'השכרת רכב בנתב"ג עם משלוח לטרמינל 24/7 — לתיירים, ישראלים חוזרים מחו"ל ואנשי עסקים.',
    metaEn: 'Car rental at Ben Gurion Airport with 24/7 terminal delivery — for tourists, returning residents and business travelers.',
    bodyHe:
      'נוחתים בנתב"ג ורוצים להתחיל לנסוע בלי לעמוד בתור למונית או לאוטובוס? שירות המשלוח שלנו לנמל התעופה עובד 24/7 — הרכב מגיע אליכם לטרמינל, ומהרגע הזה יש גישה מהירה לכבישים הראשיים לכל הארץ. השכרת רכב בנתב"ג מתאימה לתיירים שמגיעים לישראל בפעם הראשונה, לישראלים שחוזרים מחו"ל בלי רכב בבית, ולנוסעי עסקים שצריכים לזוז מהר — עם צי רכבים רחב מקומפקטי ועד יוקרה, ושירות אישי שמלווה את SmartCar כבר משנת 2003. אפשר גם לאסוף רכב בנתב"ג ולהחזיר אותו בנתב"ג בסוף הטיול, בלי קשר לאיפה הוזמן הרכב במקור — נוח מאוד אם אתם צריכים רכב גדול כבר מהנחיתה ולכל אורך החופשה.',
    bodyEn:
      'Landing at Ben Gurion Airport and want to get moving without waiting in the taxi or bus line? Our airport delivery service runs 24/7 — your car is brought straight to the terminal, and from there it\'s a quick run onto the main highways to anywhere in the country. Car rental at Ben Gurion works for first-time visitors to Israel, returning residents without a car at home, and business travelers who need to move fast — with a fleet from compact to luxury and the personal service SmartCar has offered since 2003. You can also pick up and return the car right here at the airport, regardless of where it was booked from — ideal if you need a larger vehicle from the moment you land and want to keep it for the whole trip.',
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const branch = BRANCHES.find((b) => b.id === id);
  if (!branch) return {};
  const isHe = locale === 'he';
  const city = isHe ? DISPLAY_CITY[branch.id].he : DISPLAY_CITY[branch.id].en;
  const content = CONTENT[branch.id];
  return {
    title: isHe ? `השכרת רכב ב${city} | SmartCar` : `Car Rental in ${city} | SmartCar`,
    description: isHe ? content.metaHe : content.metaEn,
    alternates: localeAlternates(locale, `branches/${branch.id}`),
  };
}

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const branch = BRANCHES.find((b) => b.id === id);
  if (!branch) notFound();
  const isHe = locale === 'he';
  const city = isHe ? DISPLAY_CITY[branch.id].he : DISPLAY_CITY[branch.id].en;
  const content = CONTENT[branch.id];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://smartcar.co.il';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AutoRental',
    name: `SmartCar ${isHe ? branch.nameHe : branch.nameEn}`,
    description: isHe ? content.metaHe : content.metaEn,
    url: `${baseUrl}/${locale}/branches/${branch.id}`,
    telephone: branch.phone,
    image: `${baseUrl}${branch.image}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: isHe ? branch.streetHe : branch.streetEn,
      addressLocality: isHe ? branch.cityHe : branch.cityEn,
      addressCountry: 'IL',
    },
    hasMap: mapsUrl(branch),
  };

  return (
    <div dir={isHe ? 'rtl' : 'ltr'} className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      {/* Hero image */}
      <div className="relative h-64 sm:h-80 md:h-96 overflow-hidden">
        <Image
          src={branch.image}
          alt={isHe ? `סניף SmartCar ${city}` : `SmartCar ${city} branch`}
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow">
            {isHe ? `השכרת רכב ב${city}` : `Car Rental in ${city}`}
          </h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <p className="text-gray-700 text-lg leading-relaxed mb-8 text-start">
          {isHe ? content.bodyHe : content.bodyEn}
        </p>

        <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
          <div className="flex items-start gap-2 mb-3">
            <span className="text-[#B64916] mt-0.5 shrink-0">📍</span>
            <p className="text-[#0D2B2B] font-medium text-sm">
              {isHe ? `${branch.streetHe}, ${branch.cityHe}` : `${branch.streetEn}, ${branch.cityEn}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 shrink-0">📞</span>
            <a href={`tel:${branch.phone}`} className="text-[#B64916] font-bold hover:underline">
              {branch.phone}
            </a>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-10">
          <a
            href={wazeUrl(branch)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-[#007DAC] text-white py-3 px-4 rounded-xl text-center font-bold hover:bg-blue-500 transition-colors text-sm min-w-[120px]"
          >
            🧭 Waze
          </a>
          <a
            href={mapsUrl(branch)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-[#2D5F5F] text-white py-3 px-4 rounded-xl text-center font-bold hover:bg-[#1a3f3f] transition-colors text-sm min-w-[120px]"
          >
            🗺 {isHe ? 'מפות' : 'Maps'}
          </a>
          <Link
            href={`/${locale}/rental`}
            className="flex-1 bg-[#C24E17] text-white py-3 px-4 rounded-xl text-center font-bold hover:opacity-90 transition-opacity text-sm min-w-[120px]"
          >
            {isHe ? 'השכר רכב עכשיו' : 'Book a Vehicle'}
          </Link>
        </div>

        <Link
          href={`/${locale}/branches`}
          className="text-sm text-[#2D5F5F] hover:underline font-medium"
        >
          {isHe ? '← כל הסניפים ושעות הפעילות' : '← All branches and opening hours'}
        </Link>
      </div>
    </div>
  );
}
