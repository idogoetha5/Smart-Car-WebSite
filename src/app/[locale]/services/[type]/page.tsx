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
    <svg viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-4">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  ),
  'new-driver': (
    <svg viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-4">
      <rect x="4" y="3" width="16" height="18" rx="2"/>
      <path d="M8 7h8M8 11h8M8 15h5"/>
      <circle cx="17" cy="17" r="3"/>
      <path d="m16 17 .5.5L18 16"/>
    </svg>
  ),
  leasing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-4">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  ),
  hourly: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-4">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  ),
  commercial: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-4">
      <rect x="1" y="3" width="15" height="13" rx="1"/>
      <path d="M16 8h4l3 3v5h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  ),
  daily: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-4">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01"/>
    </svg>
  ),
  monthly: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-4">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
      <text x="12" y="19" textAnchor="middle" fontSize="7" fill="#E8743B" stroke="none" fontWeight="bold">31</text>
    </svg>
  ),
  sale: (
    <svg viewBox="0 0 24 24" fill="none" stroke="#E8743B" strokeWidth="1.5" className="w-16 h-16 mx-auto mb-4">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
};

const SERVICES: Record<string, ServiceData> = {
  business: {
    titleHe: 'השכרת רכב לעסקים',
    titleEn: 'Business Car Rental',
    subtitleHe: 'פתרונות ניידות חכמים לעסקים וחברות',
    subtitleEn: 'Smart mobility solutions for businesses and companies',
    descHe: 'אנחנו מבינים שעסק זקוק לאמינות, גמישות וחיסכון. SmartCar מציעה לעסקים חבילות השכרה מותאמות אישית עם תנאים מיוחדים, חשבוניות מסודרות וניהול פשוט של הצי.',
    descEn: 'We understand that a business needs reliability, flexibility and savings. SmartCar offers customized rental packages for businesses with special terms, proper invoices and simple fleet management.',
    featuresHe: ['חשבוניות מע"מ מסודרות', 'מחירים מיוחדים לעסקים', 'ניהול צי לעסקים', 'גמישות מלאה בביטול', 'רכבים זמינים 24/7', 'שירות אישי לחשבון עסקי'],
    featuresEn: ['VAT invoices', 'Special business pricing', 'Fleet management', 'Full cancellation flexibility', 'Vehicles available 24/7', 'Personal account manager'],
    cta: [
      { labelHe: 'השכר רכב עכשיו', labelEn: 'Rent a car now', href: 'rental', style: 'primary' },
      { labelHe: 'צור קשר לפרטים', labelEn: 'Contact us', href: 'contact', style: 'secondary' },
    ],
  },
  'new-driver': {
    titleHe: 'השכרת רכב לנהג חדש',
    titleEn: 'Car Rental for New Drivers',
    subtitleHe: 'ברוכים הבאים לדרך - בלי הגבלות מיותרות',
    subtitleEn: 'Welcome to the road — without unnecessary restrictions',
    descHe: 'אצלנו כל נהג מקבל הזדמנות. אנחנו מתמחים בהשכרה לנהגים חדשים עם רישיון של שנה ומעלה, ומציעים רכבים קלים לנהיגה ובטוחים במיוחד.',
    descEn: 'Everyone gets a chance with us. We specialize in rentals for new drivers with at least one year of license, offering easy-to-drive and especially safe vehicles.',
    featuresHe: ['מינימום שנת ניסיון בנהיגה', 'רכבים קלים ובטוחים', 'ביטוח מקיף כלול', 'תמיכה 24/7', 'מחירים נגישים', 'ייעוץ אישי לבחירת הרכב הנכון'],
    featuresEn: ['Minimum 1 year driving experience', 'Easy and safe vehicles', 'Comprehensive insurance included', '24/7 support', 'Accessible pricing', 'Personal advice for choosing the right car'],
    cta: [
      { labelHe: 'בחר רכב להשכרה', labelEn: 'Choose a rental car', href: 'rental', style: 'primary' },
      { labelHe: 'דבר איתנו', labelEn: 'Talk to us', href: 'contact', style: 'secondary' },
    ],
  },
  leasing: {
    titleHe: 'ליסינג עסקי',
    titleEn: 'Business Leasing',
    subtitleHe: 'הרכב שלך, בתנאים שלך',
    subtitleEn: 'Your car, on your terms',
    descHe: 'ליסינג פרטי ועסקי עם תנאים גמישים לכל תקציב. חוזים ל-12 עד 60 חודשים, תחזוקה כלולה, וללא הפתעות. הפתרון המשתלם ביותר לטווח ארוך.',
    descEn: 'Private and business leasing with flexible terms for every budget. Contracts from 12 to 60 months, maintenance included, and no surprises.',
    featuresHe: ['חוזים גמישים 12-60 חודשים', 'תחזוקה שוטפת כלולה', 'ביטוח מקיף אופציונלי', 'החלפת רכב בסיום חוזה', 'הטבות מס לעצמאים', 'מגוון רכבים לבחירה'],
    featuresEn: ['Flexible contracts 12–60 months', 'Ongoing maintenance included', 'Optional comprehensive insurance', 'Vehicle swap at contract end', 'Tax benefits for self-employed', 'Wide vehicle selection'],
    cta: [
      { labelHe: 'לחישוב מחיר ליסינג', labelEn: 'Calculate leasing price', href: 'leasing#calculator', style: 'primary' },
      { labelHe: 'השכרה רגילה', labelEn: 'Regular rental', href: 'rental', style: 'secondary' },
    ],
  },
  hourly: {
    titleHe: 'השכרת רכב לפי שעה',
    titleEn: 'Hourly Car Rental',
    subtitleHe: 'גמישות מקסימלית - שלם רק על מה שאתה צריך',
    subtitleEn: 'Maximum flexibility — pay only for what you need',
    descHe: 'צריך רכב לכמה שעות? לפגישה עסקית, לסידורים או לבילוי? אנחנו מציעים השכרה לפי שעה בתעריפים נוחים ובלי התחייבות מיותרת.',
    descEn: 'Need a car for a few hours? For a business meeting, errands or leisure? We offer hourly rentals at convenient rates with no unnecessary commitment.',
    featuresHe: ['תעריף לפי שעה', 'ללא מינימום ימים', 'איסוף מהיר', 'מחיר שקוף ללא הפתעות', 'זמין ברחבי הארץ', 'מתאים לצרכים מיוחדים'],
    featuresEn: ['Per-hour rate', 'No minimum days', 'Quick pickup', 'Transparent pricing', 'Available nationwide', 'Suitable for special needs'],
    cta: [
      { labelHe: 'הזמן רכב עכשיו', labelEn: 'Book a car now', href: 'rental', style: 'primary' },
      { labelHe: 'צור קשר', labelEn: 'Contact us', href: 'contact', style: 'secondary' },
    ],
  },
  commercial: {
    titleHe: 'השכרת רכב מסחרי',
    titleEn: 'Commercial Vehicle Rental',
    subtitleHe: 'כוח הובלה לעסק שלך',
    subtitleEn: 'Carrying power for your business',
    descHe: 'ואנים, רכבי משא וכלי רכב מסחריים לכל מטרה. מתאים לעסקים, קבלנים, סוחרים ואנשי מקצוע שצריכים רכב אמין להובלה.',
    descEn: 'Vans, trucks and commercial vehicles for every purpose. Ideal for businesses, contractors, traders and professionals who need reliable transport.',
    featuresHe: ['ואנים קטנים וגדולים', 'רכבי משא עד 3.5 טון', 'מתאים לכל עסק', 'אפשרות לחוזה ארוך טווח', 'תחזוקה שוטפת', 'ביטוח מסחרי'],
    featuresEn: ['Small and large vans', 'Trucks up to 3.5 tons', 'Suitable for any business', 'Long-term contract option', 'Ongoing maintenance', 'Commercial insurance'],
    cta: [
      { labelHe: 'ראה רכבים מסחריים', labelEn: 'See commercial vehicles', href: 'rental?category=VAN', style: 'primary' },
      { labelHe: 'קבל הצעת מחיר', labelEn: 'Get a quote', href: 'contact', style: 'secondary' },
    ],
  },
  daily: {
    titleHe: 'השכרת רכב ליום אחד',
    titleEn: 'One-Day Car Rental',
    subtitleHe: 'יום שלם של חופש - בלי התחייבות',
    subtitleEn: 'A full day of freedom — no commitment',
    descHe: 'השכרת יום אחד מושלמת לטיולים, ביקורים משפחתיים, נסיעות עסקיות חד פעמיות. קל, פשוט ובמחיר משתלם.',
    descEn: 'Perfect one-day rental for trips, family visits or one-time business travel. Easy, simple and at a great price.',
    featuresHe: ['השכרה מינימום ליום', 'מגוון רכבים זמינים', 'איסוף והחזרה גמישה', 'ביטוח כלול', 'ללא הפתעות במחיר', 'זמין בכל סניפינו'],
    featuresEn: ['Minimum one-day rental', 'Wide vehicle selection', 'Flexible pickup & return', 'Insurance included', 'No price surprises', 'Available at all branches'],
    cta: [
      { labelHe: 'הזמן ליום אחד', labelEn: 'Book for one day', href: 'rental', style: 'primary' },
      { labelHe: 'כל הרכבים', labelEn: 'All vehicles', href: 'catalog', style: 'secondary' },
    ],
  },
  monthly: {
    titleHe: 'השכרת רכב לחודש',
    titleEn: 'Monthly Car Rental',
    subtitleHe: 'חודש שלם של נוחות - במחיר מיוחד',
    subtitleEn: 'A full month of comfort — at a special price',
    descHe: 'השכרה חודשית היא הבחירה החכמה לתקופות ארוכות. קבל מחיר טוב יותר, יציבות ושקט נפשי לאורך זמן.',
    descEn: 'Monthly rental is the smart choice for longer periods. Get a better price, stability and peace of mind over time.',
    featuresHe: ['מחיר מיוחד לחודש', 'ביטוח מקיף כלול', 'אפשרות הארכה', 'תחזוקה בסיסית כלולה', 'גמישות בסוג הרכב', 'חשבונית מסודרת'],
    featuresEn: ['Special monthly price', 'Comprehensive insurance included', 'Extension option', 'Basic maintenance included', 'Vehicle type flexibility', 'Proper invoicing'],
    cta: [
      { labelHe: 'הזמן לחודש', labelEn: 'Book for a month', href: 'rental', style: 'primary' },
      { labelHe: 'ליסינג לטווח ארוך', labelEn: 'Long-term leasing', href: 'leasing', style: 'secondary' },
    ],
  },
  sale: {
    titleHe: 'מכירת רכב',
    titleEn: 'Cars for Sale',
    subtitleHe: 'רכבים איכותיים במחירים הוגנים',
    subtitleEn: 'Quality vehicles at fair prices',
    descHe: 'רכבים יד שנייה מצי ההשכרה שלנו - מתוחזקים, בדוקים ומוכנים לדרך. כל רכב עובר בדיקה מקיפה לפני המכירה.',
    descEn: 'Second-hand vehicles from our rental fleet — maintained, inspected and road-ready. Every car undergoes a thorough inspection before sale.',
    featuresHe: ['רכבים מתוחזקים היטב', 'היסטוריית שירות מלאה', 'בדיקה טכנית לפני מכירה', 'מחירים הוגנים', 'אפשרות מימון', 'העברת בעלות מסודרת'],
    featuresEn: ['Well-maintained vehicles', 'Full service history', 'Technical inspection before sale', 'Fair prices', 'Financing option', 'Clean ownership transfer'],
    cta: [
      { labelHe: 'ראה רכבים למכירה', labelEn: 'See cars for sale', href: 'cars-for-sale', style: 'primary' },
      { labelHe: 'צור קשר', labelEn: 'Contact us', href: 'contact', style: 'secondary' },
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
        <p className="text-[#E8743B] font-medium mb-3 tracking-wide text-sm">
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
                <svg viewBox="0 0 24 24" fill="none" stroke="#2D5F5F" strokeWidth="2.5" className="w-5 h-5 flex-shrink-0">
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
                  ? 'bg-[#E8743B] text-white hover:bg-orange-600'
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
