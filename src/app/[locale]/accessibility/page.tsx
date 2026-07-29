import { localeAlternates } from '@/lib/seo';
import { OFFICE_EMAIL, OFFICE_PHONE } from '@/lib/constants';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isHe = locale === 'he';
  return {
    title: isHe ? 'הצהרת נגישות' : 'Accessibility Statement',
    description: isHe
      ? 'הצהרת הנגישות של SmartCar: ההתאמות שבוצעו באתר, הבדיקות שנערכו והסדרי הנגישות בסניפים.'
      : "SmartCar's accessibility statement: the adjustments made to the site, the testing carried out and accessibility at our branches.",
    alternates: localeAlternates(locale, 'accessibility'),
  };
}

/** Shared so the two locales cannot drift into different heading styling. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-2 mt-2">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default async function AccessibilityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isHe = locale === 'he';

  // Values come from the shared constants rather than being typed in again,
  // so the statement cannot drift from the rest of the site.
  const contact = (
    <>
      <p className="mt-3">
        {isHe ? 'טלפון: ' : 'Phone: '}
        <a href={`tel:${OFFICE_PHONE}`} className="text-[#2D5F5F] underline">{OFFICE_PHONE}</a>
        <br />
        {isHe ? 'דוא״ל: ' : 'Email: '}
        <a href={`mailto:${OFFICE_EMAIL}`} className="text-[#2D5F5F] underline">{OFFICE_EMAIL}</a>
        <br />
        {isHe ? 'כתובת: רמת ים 122, הרצליה' : 'Address: 122 Ramat Yam Street, Herzliya'}
      </p>
    </>
  );

  return (
    <div className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 ${isHe ? 'text-right' : 'text-left'}`} dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mb-8">
        <p className="text-[#B64916] text-sm font-semibold uppercase tracking-widest mb-2">SmartCar</p>
        <h1 className="text-4xl font-black text-[#0D2B2B] mb-2">
          {isHe ? 'הצהרת נגישות' : 'Accessibility Statement'}
        </h1>
        <p className="text-gray-600 text-sm">
          {isHe ? 'עדכון אחרון: 29 ביולי 2026' : 'Statement last updated: July 29, 2026'}
        </p>
      </div>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        {isHe ? (
          <>
            <Section title="מחויבות לנגישות">
              <p>SmartCar רואה חשיבות רבה במתן שירות שוויוני, מכבד ונגיש לכלל לקוחותיה, לרבות אנשים עם מוגבלות. אנו פועלים באופן שוטף כדי לאפשר לכל אדם לקבל מידע, ליצור קשר ולהשתמש בשירותים המוצעים באתר באופן נוח, ברור ועצמאי ככל האפשר.</p>
            </Section>

            <Section title="נגישות האתר">
              <p>אתר SmartCar הונגש בהתאם להוראות חוק שוויון זכויות לאנשים עם מוגבלות ולתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע״ג–2013.</p>
              <p className="mt-2">האתר עומד בדרישות התקן הישראלי ת״י 5568 לנגישות תכנים באינטרנט ברמה AA. נוסף על כך, האתר נבדק ביחס להנחיות WCAG 2.1 ברמה AA.</p>
              <p className="mt-2">ההתאמות חלות על העמודים הציבוריים באתר בעברית ובאנגלית.</p>
            </Section>

            <Section title="התאמות הנגישות שבוצעו באתר">
              <p>בין היתר בוצעו באתר ההתאמות הבאות:</p>
              <List items={[
                'אפשרות לניווט ולהפעלת רכיבים באמצעות המקלדת.',
                'קישור לדילוג ישיר לתוכן המרכזי.',
                'מחוון מיקוד ברור בעת ניווט באמצעות המקלדת.',
                'מבנה סמנטי הכולל כותרות, אזורי תוכן ורכיבי ניווט.',
                'שמות נגישים לכפתורים, קישורים, שדות טופס ורכיבים אינטראקטיביים.',
                'תיאורים טקסטואליים לתמונות בעלות משמעות.',
                'התאמת טפסים, הוראות, הודעות שגיאה והודעות מצב לטכנולוגיות מסייעות.',
                'תמיכה בהגדלת התצוגה ובהתאמת התוכן למסכים בגדלים שונים.',
                'התאמה לשימוש במחשב, בטלפון נייד ובמסכי מגע.',
                'התאמת האתר לתצוגה בעברית מימין לשמאל ולתצוגה באנגלית.',
                'שימוש בניגודיות, בגודל טקסט ובצבעים שנועדו לאפשר קריאה ברורה.',
                'תמיכה בהעדפת המשתמש להפחתת תנועה ואנימציות.',
                'התאמת תפריטים, שאלות נפוצות, בורר תאריכים וטופסי פנייה והזמנה לשימוש נגיש.',
              ]} />
            </Section>

            <Section title="בדיקות הנגישות שבוצעו">
              <p>נגישות האתר נבדקה באמצעות שילוב של בדיקות אוטומטיות ובדיקות ידניות. הבדיקות כללו, בין היתר, ניווט באמצעות המקלדת, סדר מעבר בין רכיבים, נראות המיקוד, שמות נגישים, טפסים ורכיבים אינטראקטיביים, הגדלת התצוגה, התאמת התוכן למסכים שונים ובדיקת עמודים ומצבים דינמיים באתר.</p>
              <p className="mt-2">כמו כן בוצעו בדיקות באמצעות הטכנולוגיות המסייעות הבאות:</p>
              <List items={[
                'קורא המסך NVDA בסביבת Windows עם דפדפן Microsoft Edge.',
                'קורא המסך VoiceOver בסביבת macOS עם דפדפן Safari.',
              ]} />
              <p className="mt-2">הבדיקות נערכו בעמודים הציבוריים ובמסלולי השימוש המרכזיים באתר, בעברית ובאנגלית.</p>
            </Section>

            <Section title="תאימות לדפדפנים ולטכנולוגיות מסייעות">
              <p>האתר מיועד לשימוש בדפדפנים מודרניים ומעודכנים, ובהם Google Chrome, Microsoft Edge, Mozilla Firefox ו־Safari. האתר מבוסס על טכנולוגיות אינטרנט מקובלות, ובהן HTML, CSS, JavaScript, SVG ו־WAI-ARIA.</p>
              <p className="mt-2">לצורך חוויית שימוש מיטבית, מומלץ להשתמש בגרסה עדכנית של הדפדפן ושל הטכנולוגיה המסייעת.</p>
            </Section>

            <Section title="הסדרי נגישות בסניפים">
              <p>סניפי SmartCar בהרצליה, בתל אביב ובירושלים נגישים לקבלת קהל.</p>
              <p className="mt-2">לקבלת מידע מפורט על הסדרי הנגישות בסניף מסוים, דרכי הגעה נגישות או התאמה הנדרשת לקראת הביקור, ניתן לפנות למשרד החברה לפני ההגעה.</p>
            </Section>

            <Section title="פנייה בנושא נגישות">
              <p>אם נתקלתם בקושי בשימוש באתר או אם אתם זקוקים להתאמה מסוימת לצורך קבלת השירות, נשמח לקבל את פנייתכם ולטפל בה בהקדם.</p>
              {contact}
              <p className="mt-3">כדי שנוכל לבדוק את הפנייה ביעילות, מומלץ לציין את העמוד שבו נתקלתם בקושי, לתאר את הפעולה שניסיתם לבצע ולציין את הדפדפן והטכנולוגיה המסייעת שבהם השתמשתם, ככל שהדבר רלוונטי.</p>
              <p className="mt-3">SmartCar ממשיכה לתחזק ולשפר את נגישות האתר כחלק ממחויבותה למתן שירות שוויוני ונגיש לכלל הציבור.</p>
            </Section>
          </>
        ) : (
          <>
            <Section title="Commitment to Accessibility">
              <p>SmartCar places great importance on providing equal, respectful, and accessible service to all its customers, including people with disabilities. We continuously work to enable every person to obtain information, contact us, and use the services offered on the website as conveniently, clearly, and independently as possible.</p>
            </Section>

            <Section title="Website Accessibility">
              <p>The SmartCar website has been made accessible in accordance with the Israeli Equal Rights for Persons with Disabilities Law and the Equal Rights for Persons with Disabilities Regulations (Accessibility Adjustments to Service), 2013.</p>
              <p className="mt-2">The website complies with the requirements of Israeli Standard SI 5568 for Web Content Accessibility at Level AA. In addition, the website has been tested against the WCAG 2.1 Level AA guidelines.</p>
              <p className="mt-2">The accessibility adjustments apply to the website’s public pages in Hebrew and English.</p>
            </Section>

            <Section title="Accessibility Adjustments Implemented on the Website">
              <p>The accessibility adjustments implemented on the website include:</p>
              <List items={[
                'The ability to navigate and operate components using the keyboard.',
                'A link for skipping directly to the main content.',
                'A clear focus indicator when navigating with the keyboard.',
                'A semantic structure that includes headings, content regions, and navigation components.',
                'Accessible names for buttons, links, form fields, and interactive components.',
                'Text descriptions for meaningful images.',
                'Forms, instructions, error messages, and status messages adapted for assistive technologies.',
                'Support for display enlargement and content adaptation to different screen sizes.',
                'Compatibility with computers, mobile devices, and touchscreens.',
                'Right-to-left display support in Hebrew and English-language display support.',
                'The use of contrast, text sizes, and colors intended to support clear reading.',
                'Support for the user\u2019s preference to reduce motion and animations.',
                'Menus, frequently asked questions, the date picker, and contact and booking forms adapted for accessible use.',
              ]} />
            </Section>

            <Section title="Accessibility Testing Performed">
              <p>The website’s accessibility was tested using a combination of automated and manual testing. The tests included, among other things, keyboard navigation, the order of focus between components, focus visibility, accessible names, forms and interactive components, display enlargement, content adaptation to different screen sizes, and the testing of pages and dynamic states on the website.</p>
              <p className="mt-2">Testing was also performed using the following assistive technologies:</p>
              <List items={[
                'The NVDA screen reader in a Windows environment with the Microsoft Edge browser.',
                'The VoiceOver screen reader in a macOS environment with the Safari browser.',
              ]} />
              <p className="mt-2">The tests were conducted on the website’s public pages and principal user journeys in Hebrew and English.</p>
            </Section>

            <Section title="Compatibility with Browsers and Assistive Technologies">
              <p>The website is intended for use with modern and up-to-date browsers, including Google Chrome, Microsoft Edge, Mozilla Firefox, and Safari. The website is based on commonly used web technologies, including HTML, CSS, JavaScript, SVG, and WAI-ARIA.</p>
              <p className="mt-2">For the best possible user experience, we recommend using an up-to-date version of the browser and assistive technology.</p>
            </Section>

            <Section title="Accessibility Arrangements at Our Branches">
              <p>SmartCar branches in Herzliya, Tel Aviv and Jerusalem are accessible to the public.</p>
              <p className="mt-2">For detailed information about the accessibility arrangements at a particular branch, accessible arrival options, or an adjustment required ahead of your visit, please contact the company’s office before arriving.</p>
            </Section>

            <Section title="Accessibility Inquiries">
              <p>If you encounter difficulty using the website or require a particular adjustment in order to receive service, we would be pleased to receive your inquiry and address it as soon as possible.</p>
              {contact}
              <p className="mt-3">To help us review your inquiry efficiently, we recommend identifying the page on which you encountered the difficulty, describing the action you attempted to perform, and specifying the browser and assistive technology you used, where relevant.</p>
              <p className="mt-3">SmartCar continues to maintain and improve the accessibility of the website as part of its commitment to providing equal and accessible service to the entire public.</p>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
