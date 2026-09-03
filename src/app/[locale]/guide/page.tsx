import { localeAlternates } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isHe = locale === 'he';
  return {
    title: {
      absolute: isHe
        ? 'מדריך השכרת רכב בישראל | SmartCar'
        : 'Guide to Car Rental in Israel | SmartCar',
    },
    description: isHe
      ? 'כל מה שצריך לדעת לפני שוכרים רכב בישראל: מסירה עד הבית מול איסוף בסוכנות, השכרה בנתב"ג, ביטוח, מסמכים, נהג חדש, וההבדל בין השכרה לליסינג.'
      : 'Everything to know before renting a car in Israel: door-to-door delivery vs. branch pickup, airport rental, insurance, required documents, new drivers, and rental vs. leasing.',
    alternates: localeAlternates(locale, 'guide'),
  };
}

type Section = { id: string; qHe: string; qEn: string; bodyHe: React.ReactNode; bodyEn: React.ReactNode };

export default async function GuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isHe = locale === 'he';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://smartcar.co.il';

  const sections: Section[] = [
    {
      id: 'delivery-vs-branch',
      qHe: 'השכרת רכב עד הבית מול איסוף בסוכנות — מה עדיף?',
      qEn: 'Door-to-door delivery vs. branch pickup — which is better?',
      bodyHe: (
        <>
          <p>
            ברוב חברות ההשכרה הגדולות בישראל צריך להגיע פיזית לסניף, לעמוד בתור, ולעבור תהליך חתימה שיכול לקחת חצי שעה ומעלה — לפני שרואים בכלל את הרכב. ב-SmartCar אפשר לבחור: להגיע לאחד מהסניפים שלנו (הרצליה, תל אביב, ירושלים או נתב&quot;ג), או לבקש שהרכב יגיע ויוחזר בכתובת שלכם בכל הארץ, בתיאום מראש.
          </p>
          <p>
            מסירה עד הבית משתלמת במיוחד כשמדובר בהשכרה דחופה, כשמגיעים עם משפחה וילדים וקשה לצאת עם כל הציוד לסניף, או כשפשוט רוצים לחסוך את זמן הנסיעה וההמתנה. חתימת החוזה, בדיקת הרכב וקבלת המפתח מתבצעות במקום, מול נציג אנושי.
          </p>
        </>
      ),
      bodyEn: (
        <>
          <p>
            With most of the large rental companies in Israel you need to physically reach a branch, wait in line, and go through a signing process that can take half an hour or more — before you even see the car. With SmartCar you can choose: visit one of our branches (Herzliya, Tel Aviv, Jerusalem or Ben Gurion Airport), or have the vehicle delivered and collected at your address anywhere in Israel, by prior arrangement.
          </p>
          <p>
            Door-to-door delivery is especially useful for urgent rentals, when traveling with family and children and it&apos;s hard to get to a branch with all your luggage, or simply to save the drive and the wait. The contract signing, vehicle inspection and key handover all happen on the spot, with a human representative.
          </p>
        </>
      ),
    },
    {
      id: 'airport',
      qHe: 'השכרת רכב בנתב"ג — איך זה עובד?',
      qEn: 'Car rental at Ben Gurion Airport — how does it work?',
      bodyHe: (
        <>
          <p>
            שירות המשלוח שלנו לנמל התעופה בן גוריון עובד 24/7 — הרכב מגיע אליכם לטרמינל, כך שאין צורך לעמוד בתור להסעה לסניף חיצוני. אפשר גם לאסוף רכב בכל מקום בארץ ולהחזיר אותו בנתב&quot;ג בסוף הטיול, ולהיפך.
          </p>
          <p>
            <Link href={`/${locale}/branches/airport`} className="text-[#2D5F5F] font-semibold hover:underline">
              לפרטים מלאים על סניף נתב&quot;ג ←
            </Link>
          </p>
        </>
      ),
      bodyEn: (
        <>
          <p>
            Our Ben Gurion Airport delivery service runs 24/7 — your car is brought straight to the terminal, so there&apos;s no need to wait for a shuttle to an off-site branch. You can also pick up a vehicle anywhere in Israel and return it at the airport at the end of your trip, or the other way around.
          </p>
          <p>
            <Link href={`/${locale}/branches/airport`} className="text-[#2D5F5F] font-semibold hover:underline">
              Full details on the airport branch →
            </Link>
          </p>
        </>
      ),
    },
    {
      id: 'rental-vs-leasing',
      qHe: 'מה ההבדל בין השכרת רכב לליסינג?',
      qEn: 'What is the difference between renting and leasing?',
      bodyHe: (
        <>
          <p>
            השכרת רכב מיועדת לתקופה קצרה — מיום בודד ועד כמה שבועות — עם התחייבות מינימלית וגמישות מלאה בתאריכים. ליסינג הוא מסלול לטווח ארוך (בדרך כלל חודשים עד שנים), עם מחיר חודשי קבוע שכולל בדרך כלל טיפולים וביטוח, ומתאים למי שצריך רכב לתקופה ממושכת בלי לרכוש אותו — פרטי, עסקי או לצי רכבים.
          </p>
          <p>
            <Link href={`/${locale}/leasing`} className="text-[#2D5F5F] font-semibold hover:underline">
              {isHe ? 'לכל מסלולי הליסינג ←' : ''}
            </Link>
          </p>
        </>
      ),
      bodyEn: (
        <>
          <p>
            Car rental is meant for short periods — from a single day up to a few weeks — with minimal commitment and full date flexibility. Leasing is a long-term arrangement (typically months to years), with a fixed monthly price that usually includes maintenance and insurance, and suits anyone who needs a vehicle for an extended period without buying it — private, business or fleet.
          </p>
          <p>
            <Link href={`/${locale}/leasing`} className="text-[#2D5F5F] font-semibold hover:underline">
              See all leasing plans →
            </Link>
          </p>
        </>
      ),
    },
    {
      id: 'new-driver',
      qHe: 'השכרת רכב לנהג חדש או צעיר',
      qEn: 'Car rental for a new or young driver',
      bodyHe: (
        <>
          <p>
            השכרה זמינה מגיל 18, גם לנהגים חדשים. נדרש רישיון נהיגה בתוקף, רישום מראש בחוזה ההשכרה וכיסוי ביטוחי מתאים. לנהג חדש או צעיר עשויה לחול תוספת, בהתאם לגיל וותק הרישיון.
          </p>
          <p>
            <Link href={`/${locale}/services/new-driver`} className="text-[#2D5F5F] font-semibold hover:underline">
              {isHe ? 'לפרטים על השכרה לנהג חדש ←' : ''}
            </Link>
          </p>
        </>
      ),
      bodyEn: (
        <>
          <p>
            Rental is available from age 18, including new drivers. A valid driving licence, advance registration in the rental agreement and suitable insurance coverage are required. A new or young driver surcharge may apply, depending on age and licence history.
          </p>
          <p>
            <Link href={`/${locale}/services/new-driver`} className="text-[#2D5F5F] font-semibold hover:underline">
              New driver rental details →
            </Link>
          </p>
        </>
      ),
    },
    {
      id: 'insurance-documents',
      qHe: 'ביטוח ומסמכים נדרשים',
      qEn: 'Insurance and required documents',
      bodyHe: (
        <>
          <p>
            כל השכרה כוללת ביטוח בסיסי, עם אפשרות להפחית או לבטל את דמי ההשתתפות העצמית בנזק. בעת איסוף הרכב יש להציג תעודת זהות או דרכון, רישיון נהיגה מקורי בתוקף וכרטיס אשראי על שם השוכר לצורך הפיקדון. לרישיון זר עשוי להידרש גם רישיון בינלאומי או תרגום רשמי.
          </p>
          <p>
            <Link href={`/${locale}/insurance`} className="text-[#2D5F5F] font-semibold hover:underline">
              לפירוט מלא של הכיסוי הביטוחי וטבלת ההשתתפות העצמית ←
            </Link>
          </p>
        </>
      ),
      bodyEn: (
        <>
          <p>
            Every rental includes basic insurance coverage, with an option to reduce or waive the damage deductible. When collecting the vehicle, present an ID card or passport, an original valid driving licence, and a credit card in the renter&apos;s name for the deposit. A foreign licence may also require an International Driving Permit or an official translation.
          </p>
          <p>
            <Link href={`/${locale}/insurance`} className="text-[#2D5F5F] font-semibold hover:underline">
              Full insurance coverage and deductible table →
            </Link>
          </p>
        </>
      ),
    },
    {
      id: 'cancellation',
      qHe: 'מדיניות ביטול',
      qEn: 'Cancellation policy',
      bodyHe: (
        <>
          <p>
            יותר מ־72 שעות לפני האיסוף — החזר מלא. 72–48 שעות לפני — חיוב של 25% מדמי השכירות הבסיסיים. 48–24 שעות לפני — 50%. פחות מ־24 שעות או אי־הופעה — 100%. שינוי תאריכים ללא חיוב אפשרי עד 48 שעות לפני האיסוף, בכפוף לזמינות.
          </p>
          <p>
            <Link href={`/${locale}/terms`} className="text-[#2D5F5F] font-semibold hover:underline">
              למדיניות הביטול המלאה ולתנאי ההשכרה ←
            </Link>
          </p>
        </>
      ),
      bodyEn: (
        <>
          <p>
            More than 72 hours before pickup — full refund. 72–48 hours before — a charge of 25% of the base rental fee. 48–24 hours before — 50%. Under 24 hours or a no-show — 100%. Date changes are free of charge up to 48 hours before pickup, subject to availability.
          </p>
          <p>
            <Link href={`/${locale}/terms`} className="text-[#2D5F5F] font-semibold hover:underline">
              Full cancellation policy and rental terms →
            </Link>
          </p>
        </>
      ),
    },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: isHe ? 'מדריך השכרת רכב בישראל' : 'Guide to Car Rental in Israel',
    description: isHe
      ? 'כל מה שצריך לדעת לפני שוכרים רכב בישראל: מסירה עד הבית, נתב"ג, ביטוח, מסמכים, נהג חדש, וההבדל בין השכרה לליסינג.'
      : 'Everything to know before renting a car in Israel: door-to-door delivery, the airport, insurance, documents, new drivers, and rental vs. leasing.',
    inLanguage: isHe ? 'he' : 'en',
    mainEntityOfPage: `${baseUrl}/${locale}/guide`,
    author: { '@type': 'Organization', name: 'SmartCar', url: `${baseUrl}/${locale}` },
    publisher: { '@type': 'Organization', name: 'SmartCar', url: `${baseUrl}/${locale}` },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: isHe ? 'ראשי' : 'Home', item: `${baseUrl}/${locale}` },
      { '@type': 'ListItem', position: 2, name: isHe ? 'מדריך השכרת רכב' : 'Car Rental Guide', item: `${baseUrl}/${locale}/guide` },
    ],
  };

  return (
    <div
      className={`max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 ${isHe ? 'text-right' : 'text-left'}`}
      dir={isHe ? 'rtl' : 'ltr'}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c') }}
      />

      <p className="text-[#B64916] text-sm font-semibold uppercase tracking-widest mb-2">SmartCar</p>
      <h1 className="text-4xl font-black text-[#0D2B2B] mb-4">
        {isHe ? 'מדריך השכרת רכב בישראל' : 'Guide to Car Rental in Israel'}
      </h1>
      <p className="text-gray-600 text-base leading-relaxed mb-12 max-w-2xl">
        {isHe
          ? 'לפני ששוכרים רכב בישראל, כדאי להכיר את ההבדלים בין הדרכים השונות לעשות את זה, מה כלול בביטוח, ומה המסמכים והתנאים שיחכו לכם. הכל מרוכז כאן.'
          : 'Before renting a car in Israel, it helps to know the different ways to do it, what insurance actually covers, and which documents and terms to expect. It is all gathered here.'}
      </p>

      <div className="space-y-12">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <h2 className="text-xl font-bold text-[#0D2B2B] mb-3">{isHe ? s.qHe : s.qEn}</h2>
            <div className="text-gray-700 leading-relaxed space-y-3">
              {isHe ? s.bodyHe : s.bodyEn}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-14 flex flex-col sm:flex-row gap-3">
        <Link
          href={`/${locale}/rental`}
          className="flex-1 text-center bg-[#C24E17] hover:bg-[#d4632a] text-white font-bold rounded-full px-6 py-3 transition-colors shadow-md"
        >
          {isHe ? 'השכר רכב עכשיו' : 'Book a Vehicle'}
        </Link>
        <Link
          href={`/${locale}/branches`}
          className="flex-1 text-center bg-[#2D5F5F] hover:bg-[#1a3f3f] text-white font-bold rounded-full px-6 py-3 transition-colors"
        >
          {isHe ? 'כל הסניפים' : 'All Branches'}
        </Link>
      </div>
    </div>
  );
}
