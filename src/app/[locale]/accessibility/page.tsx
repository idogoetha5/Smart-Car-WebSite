import { localeAlternates } from '@/lib/seo';
import LegalContact from '@/components/legal/LegalContact';
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isHe = locale === 'he';
  return {
    title: isHe ? 'הצהרת נגישות' : 'Accessibility Statement',
    description:
      locale === 'he'
        ? 'הצהרת הנגישות של SmartCar: מה הונגש באתר, מה עדיין בתהליך ואיך לפנות אלינו בנושא נגישות.'
        : "SmartCar's accessibility statement: what has been made accessible, what is still in progress and how to contact us about accessibility.",
    alternates: localeAlternates(locale, 'accessibility'),
  };
}

export default async function AccessibilityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isHe = locale === 'he';

  return (
    <div className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 ${isHe ? 'text-right' : 'text-left'}`} dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mb-8">
        <p className="text-[#B64916] text-sm font-semibold uppercase tracking-widest mb-2">SmartCar</p>
        <h1 className="text-4xl font-black text-[#0D2B2B] mb-2">
          {isHe ? 'הצהרת נגישות' : 'Accessibility Statement'}
        </h1>
        <p className="text-gray-600 text-sm">
          {isHe ? 'עדכון אחרון: יולי 2026' : 'Last updated: July 2026'}
        </p>
      </div>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        {isHe ? (
          <>
            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">מחויבות לנגישות</h2>
              <p>SmartCar מחויבת לספק שירות שוויוני ונגיש לכלל הציבור, כולל אנשים עם מוגבלויות. אנו פועלים להנגיש את האתר בהתאם לתקן ישראלי 5568 ולהנחיות נגישות תוכן אינטרנט (WCAG) 2.1 ברמה AA.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">אמצעי נגישות שיושמו באתר</h2>
              <p className="mb-2">בין היתר, יושמו באתר האמצעים הבאים:</p>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>ניווט באמצעות מקלדת</li>
                <li>תיוג מבני ותגיות ARIA לרכיבי ממשק דינמיים, לתמיכה בקוראי מסך נפוצים</li>
                <li>עיצוב שמתחשב בדרישות ניגודיות צבעים לפי תקן AA</li>
                <li>טקסטים חלופיים לתמונות</li>
                <li>פונטים קריאים בגדלים מותאמים</li>
                <li>תמיכה בהגדלת טקסט עד 200% ללא אובדן תוכן</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">בדיקה אוטומטית שבוצעה</h2>
              <p>ביולי 2026 בוצעה בדיקת נגישות אוטומטית באמצעות שני כלים עצמאיים (pa11y ו-axe-core) על פני כל דפי האתר הפונים ללקוח, בעברית ובאנגלית. הבדיקה איתרה וטיפלה בשני הליקויים הנפוצים ביותר שנמצאו — ניגודיות צבעים לא מספקת ותוויות חסרות בשדות טפסים — וכן ליקוי נוסף שנמצא בבדיקה ידנית: "מלכודת מקלדת" בבורר התאריכים, שתוקנה.</p>
              <p className="mt-2">האתר נבדק באמצעות כלים אוטומטיים ובבדיקות נגישות ידניות. אנו פועלים באופן שוטף לשמירה על נגישות האתר ולשיפורה, בהתאם להתפתחות האתר והשירותים המוצעים בו. אם נתקלתם בקושי בשימוש באתר, נשמח לקבל את פנייתכם ולטפל בה בהקדם.</p>
              <p className="mt-2">הנגשת האתר היא תהליך מתמשך, ואנו פועלים באופן שוטף לאיתור ותיקון בעיות נוספות ולשיפור ההתאמה לתקן ישראלי 5568 ולהנחיות WCAG 2.1 ברמה AA.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">דיווח על בעיות נגישות</h2>
              <p>נתקלת בבעיית נגישות? נשמח לשמוע ולתקן. ניתן לפנות אלינו בכל אחת מהדרכים הבאות:</p>
            </section>

            <LegalContact topic="accessibility" locale={locale} />

            <div className="bg-[#eef6f6] rounded-2xl p-6 border border-[#B8D8D8]">
              <p className="text-sm text-gray-600">
                <strong>בסיס חוקי:</strong> הצהרה זו ניתנה בהתאם לתיקון 35 לחוק שוויון זכויות לאנשים עם מוגבלות, תשנ"ח-1998, ובהתאם לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), תשע"ג-2013.
              </p>
            </div>
          </>
        ) : (
          <>
            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">Our Commitment</h2>
              <p>SmartCar is committed to providing equal access to all users, including people with disabilities. We work to conform to Israeli Standard 5568 and WCAG 2.1 AA guidelines.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">Accessibility Measures Implemented</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Keyboard navigation</li>
                <li>Structured markup and ARIA tags for dynamic interface elements, to support common screen readers</li>
                <li>Design that takes AA color contrast requirements into account</li>
                <li>Alternative text for images</li>
                <li>Text can be enlarged up to 200% without content loss</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">Automated Testing Performed</h2>
              <p>In July 2026, an automated accessibility scan was performed using two independent tools (pa11y and axe-core) across every customer-facing page on the site, in both Hebrew and English. The scan identified and we fixed the two most common issues found — insufficient color contrast and missing labels on form fields — along with one additional issue found through manual review: a keyboard trap in the date picker, which has been fixed.</p>
              <p className="mt-2">The website has been reviewed using automated tools and manual accessibility checks. We continuously work to maintain and improve its accessibility as the website and its services evolve. If you encounter any accessibility difficulty while using the website, please contact us so we can address it promptly.</p>
              <p className="mt-2">Accessibility is an ongoing process. We continuously work to identify and fix additional issues and improve conformance with Israeli Standard 5568 and WCAG 2.1 AA.</p>
            </section>

            <LegalContact topic="accessibility" locale={locale} />
          </>
        )}
      </div>
    </div>
  );
}
