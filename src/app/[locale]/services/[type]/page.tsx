import { localeAlternates } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { JSX } from 'react';

type ServiceData = {
  titleHe: string;
  titleEn: string;
  subtitleHe: string;
  subtitleEn: string;
  descHe: string;
  descEn: string;
  featuresHe: string[];
  featuresEn: string[];
  cta: { labelHe: string; labelEn: string; href: string; style: 'primary' | 'secondary' }[];
};

const SERVICE_ICONS: Record<string, JSX.Element> = {
  business: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-4">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  ),
  'new-driver': (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-4">
      <rect x="4" y="3" width="16" height="18" rx="2"/>
      <path d="M8 7h8M8 11h8M8 15h5"/>
      <circle cx="17" cy="17" r="3"/>
      <path d="m16 17 .5.5L18 16"/>
    </svg>
  ),
  leasing: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-4">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  ),
  hourly: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-4">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  ),
  commercial: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-4">
      <rect x="1" y="3" width="15" height="13" rx="1"/>
      <path d="M16 8h4l3 3v5h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  daily: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-4">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01"/>
    </svg>
  ),
  monthly: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-4">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
      <text x="12" y="19" textAnchor="middle" fontSize="7" fill="#E8743B" stroke="none" fontWeight="bold">31</text>
    </svg>
  ),
  sale: (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-4">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
};

const SERVICES: Record<string, ServiceData> = {
  business: {
    titleHe: 'רכב לעסק, מהשכרה קצרה ועד צי קבוע',
    titleEn: 'Vehicles for business, from a short rental to a standing fleet',
    subtitleHe: 'תנאים ברורים לפני שיוצאים לדרך',
    subtitleEn: 'Clear terms before you set off',
    descHe: 'פתרונות לעסק שצריך רכב לכמה שעות, לתקופה זמנית או לצי שלם. נתאים את מספר הרכבים, הקבוצות, התקופה והמסירה לאופן שבו העסק עובד.',
    descEn: 'Solutions for a business that needs a vehicle for a few hours, for a temporary period or as a full fleet. We match the number of vehicles, the groups, the term and the delivery to the way the business works.',
    featuresHe: ['מרכב יחיד ועד צי של מאות רכבים', 'השכרה קצרה או ממושכת', 'מסחריות ורכבים פרטיים', 'איש קשר ושירות אישי'],
    featuresEn: ['From a single vehicle to a fleet of hundreds', 'Short or extended rental', 'Commercial and private vehicles', 'A named contact and personal service'],
    cta: [
      { labelHe: 'שליחת בקשה', labelEn: 'Send request', href: 'rental', style: 'primary' },
      { labelHe: 'יצירת קשר', labelEn: 'Contact us', href: 'contact', style: 'secondary' },
    ],
  },
  'new-driver': {
    titleHe: 'השכרת רכב לנהגים חדשים וצעירים',
    titleEn: 'Car rental for new and young drivers',
    subtitleHe: 'תנאים ברורים לפני שיוצאים לדרך',
    subtitleEn: 'Clear terms before you set off',
    descHe: 'השכרת רכב זמינה מגיל 18, גם לנהגים שטרם צברו שנתיים ותק. כל נהג חייב להחזיק ברישיון נהיגה תקף, להירשם מראש בחוזה ההשכרה ולהיות מכוסה בביטוח או בכיסוי הביטוחי המתאים. הנהיגה כפופה למגבלות החלות על הנהג לפי גילו והוותק שלו.',
    descEn: 'Car rental is available from age 18, including drivers with less than two years of licence history. Every driver must hold a valid driving licence, be registered in advance in the rental agreement and have suitable coverage. Legal restrictions that apply based on the driver\'s age and licence history remain in force.',
    featuresHe: ['השכרה מגיל 18', 'גם בשנתיים הראשונות לרישיון', 'התאמת קבוצת רכב וביטוח לנהג', 'הסבר ברור על התנאים לפני האישור'],
    featuresEn: ['Rental from age 18', 'Also within the first two years of the licence', 'Vehicle group and insurance matched to the driver', 'Clear explanation of the terms before confirmation'],
    cta: [
      { labelHe: 'שליחת בקשה', labelEn: 'Send request', href: 'rental', style: 'primary' },
      { labelHe: 'דברו איתנו', labelEn: 'Talk to us', href: 'contact', style: 'secondary' },
    ],
  },
  leasing: {
    // Must not state that maintenance or comprehensive insurance is
    // included in every plan — what a plan contains varies and is fixed in
    // the written quote (report §9).
    titleHe: 'ליסינג שמתאים לאופן שבו אתם נוסעים',
    titleEn: 'Leasing matched to the way you drive',
    subtitleHe: 'ליסינג פרטי ועסקי',
    subtitleEn: 'Private and business leasing',
    descHe: 'מסלולים ללקוחות פרטיים, לעסקים ולציי רכב, עם התאמה לתקופה, למספר הקילומטרים ולשירותים שאתם צריכים.',
    descEn: 'Plans for private customers, businesses and fleets, tailored to the term, mileage and services you need.',
    featuresHe: ['מסלול מותאם לתקופה ולמספר הקילומטרים', 'אפשרות לשלב שירותי תחזוקה לפי המסלול', 'אפשרויות ביטוח ושירות לפי ההצעה', 'מענה ושירות 24/7'],
    featuresEn: ['A plan matched to the term and mileage', 'Maintenance services can be included depending on the plan', 'Insurance and service options according to the quote', '24/7 support and service'],
    cta: [
      { labelHe: 'קבלת הצעת ליסינג', labelEn: 'Request a leasing quote', href: 'leasing#calculator', style: 'primary' },
      { labelHe: 'השכרה רגילה', labelEn: 'Regular rental', href: 'rental', style: 'secondary' },
    ],
  },
  hourly: {
    titleHe: 'השכרת רכב לפי שעה',
    titleEn: 'Hourly Car Rental',
    subtitleHe: 'תנאים ברורים לפני שיוצאים לדרך',
    subtitleEn: 'Clear terms before you set off',
    descHe: 'צריכים רכב לכמה שעות? שלחו בקשה עם המיקום והזמנים, ונבדוק זמינות ותנאים.',
    descEn: 'Need a vehicle for a few hours? Send a request with the location and times, and we will check availability and terms.',
    featuresHe: ['לשעות בודדות', 'בתיאום מראש', 'לפרטיים ולעסקים', 'מחיר מאושר לפני ההשכרה'],
    featuresEn: ['For a few hours', 'By prior arrangement', 'For private and business customers', 'Price confirmed before the rental'],
    cta: [
      { labelHe: 'שליחת בקשה', labelEn: 'Send request', href: 'rental', style: 'primary' },
      { labelHe: 'יצירת קשר', labelEn: 'Contact us', href: 'contact', style: 'secondary' },
    ],
  },
  commercial: {
    titleHe: 'השכרת רכב מסחרי',
    titleEn: 'Commercial Vehicle Rental',
    subtitleHe: 'תנאים ברורים לפני שיוצאים לדרך',
    subtitleEn: 'Clear terms before you set off',
    descHe: 'מסחריות להובלה, התקנות, שליחויות ועבודה שוטפת. ספרו לנו מה מעמיסים, לאן נוסעים ולכמה זמן, ונבדוק את הקבוצה המתאימה.',
    descEn: 'Commercial vehicles for haulage, installations, deliveries and everyday work. Tell us what you are carrying, where you are going and for how long, and we will check the right vehicle group.',
    featuresHe: ['מבחר גדלים', 'תקופות קצרות וארוכות', 'מסירה בתיאום', 'התאמה לצורכי העסק'],
    featuresEn: ['A range of sizes', 'Short and long periods', 'Coordinated delivery', 'Matched to the needs of the business'],
    cta: [
      { labelHe: 'ראו רכבים מסחריים', labelEn: 'See commercial vehicles', href: 'rental?category=VAN', style: 'primary' },
      { labelHe: 'שליחת בקשה', labelEn: 'Send request', href: 'contact', style: 'secondary' },
    ],
  },
  daily: {
    titleHe: 'השכרת רכב ליום או לכמה ימים',
    titleEn: 'Car rental for a day or a few days',
    subtitleHe: 'תנאים ברורים לפני שיוצאים לדרך',
    subtitleEn: 'Clear terms before you set off',
    descHe: 'פתרון לנסיעה קצרה, פגישה, אירוע או חופשה. בוחרים תאריכים ומיקום, ואנחנו בודקים את הצי המלא ומתאמים את הרכב המתאים.',
    descEn: 'A solution for a short trip, a meeting, an event or a holiday. Choose dates and a location, and we will check the full fleet and arrange a suitable vehicle.',
    featuresHe: ['מבחר קבוצות רכב', 'מסירה והחזרה בתיאום', 'תנאים ומחיר באישור כתוב', 'מענה 24/7'],
    featuresEn: ['A range of vehicle groups', 'Coordinated delivery and return', 'Terms and price in written confirmation', '24/7 support'],
    cta: [
      { labelHe: 'שליחת בקשה', labelEn: 'Send request', href: 'rental', style: 'primary' },
      { labelHe: 'כל הרכבים', labelEn: 'All vehicles', href: 'catalog', style: 'secondary' },
    ],
  },
  monthly: {
    titleHe: 'השכרת רכב לחודש ולתקופות ארוכות',
    titleEn: 'Car rental for a month and longer periods',
    subtitleHe: 'תנאים ברורים לפני שיוצאים לדרך',
    subtitleEn: 'Clear terms before you set off',
    descHe: 'פתרון גמיש למי שצריך רכב לתקופה ארוכה בלי להתחייב למסלול ליסינג. התנאים, מכסת הקילומטרים והשירותים נקבעים בהצעה.',
    descEn: 'A flexible solution for anyone who needs a vehicle for a long period without committing to a leasing plan. The terms, mileage allowance and services are set out in the quote.',
    featuresHe: ['תקופה גמישה', 'מכסת קילומטרים ברורה', 'אפשרויות שירות וביטוח', 'התאמה לפרטיים ולעסקים'],
    featuresEn: ['A flexible term', 'A clear mileage allowance', 'Service and insurance options', 'Suitable for private and business customers'],
    cta: [
      { labelHe: 'שליחת בקשה', labelEn: 'Send request', href: 'rental', style: 'primary' },
      { labelHe: 'ליסינג לטווח ארוך', labelEn: 'Long-term leasing', href: 'leasing', style: 'secondary' },
    ],
  },
  sale: {
    // Cautious wording only: claims about inspection, full service history,
    // warranty and financing must not be published until an operational
    // process and document back them (report §11).
    titleHe: 'רכבים נבחרים מהצי למכירה',
    titleEn: 'Selected fleet vehicles for sale',
    subtitleHe: 'מידע ומסמכים לגבי הרכב הספציפי',
    subtitleEn: 'Information and documents for the specific vehicle',
    descHe: 'מעת לעת אנו מציעים למכירה רכבים מהצי. לכל רכב נציג את הפרטים והמסמכים הזמינים לגביו, ונאפשר לקבל מידע נוסף לפני קבלת החלטה.',
    descEn: 'From time to time we offer fleet vehicles for sale. For each vehicle we present the details and documents available for it, and you can request further information before making a decision.',
    featuresHe: ['רכבים מצי ההשכרה', 'פרטים לגבי הרכב הספציפי', 'מסמכי גילוי לפני העסקה', 'מענה אישי לשאלות'],
    featuresEn: ['Vehicles from the rental fleet', 'Details for the specific vehicle', 'Disclosure documents before the sale', 'Personal answers to your questions'],
    cta: [
      { labelHe: 'ראו רכבים למכירה', labelEn: 'See cars for sale', href: 'cars-for-sale', style: 'primary' },
      { labelHe: 'קבלת פרטים', labelEn: 'Request details', href: 'contact', style: 'secondary' },
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; type: string }>;
}): Promise<Metadata> {
  const { locale, type } = await params;
  const service = SERVICES[type];
  if (!service) return {};
  return {
    title: locale === 'he' ? service.titleHe : service.titleEn,
    alternates: localeAlternates(locale, `services/${type}`),
  };
}

export default async function ServicePage({
  params,
}: {
  params: Promise<{ locale: string; type: string }>;
}) {
  const { locale, type } = await params;
  const service = SERVICES[type];
  const isHe = locale === 'he';

  if (!service) notFound();

  const title    = isHe ? service.titleHe    : service.titleEn;
  const subtitle = isHe ? service.subtitleHe : service.subtitleEn;
  const desc     = isHe ? service.descHe     : service.descEn;
  const features = isHe ? service.featuresHe : service.featuresEn;

  return (
    <div dir={isHe ? 'rtl' : 'ltr'} className="min-h-screen">

      {/* Hero */}
      <div className="bg-[#0D2B2B] py-20 px-6 text-center">
        {SERVICE_ICONS[type]}
        <p className="text-[#B64916] font-medium mb-3 tracking-wide text-sm">
          {isHe ? 'השירותים שלנו' : 'Our Services'}
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">{title}</h1>
        <p className="text-[#B8D8D8] text-xl max-w-2xl mx-auto">{subtitle}</p>
      </div>

      {/* Description */}
      <div className="bg-white py-16 px-6">
        <div className="max-w-3xl mx-auto text-start">
          <p className="text-gray-600 text-lg leading-loose">{desc}</p>
        </div>
      </div>

      {/* Features */}
      <div className="bg-gray-50 py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-[#0D2B2B] text-center mb-10">
            {isHe ? 'מה כלול בשירות' : "What's included"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature) => (
              <div key={feature} className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm">
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="#2D5F5F" strokeWidth="2.5" className="w-5 h-5 flex-shrink-0">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span className="text-gray-700 font-medium">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-[#0D2B2B] py-16 px-6 text-center">
        <h2 className="text-2xl font-bold text-white mb-8">
          {isHe ? 'מוכנים להתחיל?' : 'Ready to get started?'}
        </h2>
        <div className="flex gap-4 justify-center flex-wrap">
          {service.cta.map((btn) => (
            <Link
              key={btn.labelHe}
              href={`/${locale}/${btn.href}`}
              className={`font-bold px-8 py-4 rounded-xl transition-colors text-lg ${
                btn.style === 'primary'
                  ? 'bg-[#C24E17] text-white hover:bg-orange-600'
                  : 'border-2 border-white text-white hover:bg-white hover:text-[#0D2B2B]'
              }`}
            >
              {isHe ? btn.labelHe : btn.labelEn}
            </Link>
          ))}
        </div>
        <p className="text-[#B8D8D8] mt-6 text-sm">
          09-9509757 &nbsp;|&nbsp; office@smartcar.co.il
        </p>
      </div>

    </div>
  );
}
