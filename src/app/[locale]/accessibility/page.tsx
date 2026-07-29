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
        {isHe ? 'כתובת: רמת ים 122, הרצליה' : 'Address: Ramat Yam 122, Herzliya, Israel'}
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
          {isHe ? 'עדכון אחרון: יולי 2026' : 'Last updated: July 2026'}
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
            <Section title="Our Commitment to Accessibility">
              <p>SmartCar attaches great importance to providing an equal, respectful and accessible service to all of its customers, including people with disabilities. We work on an ongoing basis so that every person can obtain information, get in touch and use the services offered on this site conveniently, clearly and as independently as possible.</p>
            </Section>

            <Section title="Accessibility of This Website">
              <p>The SmartCar website has been made accessible in accordance with the Equal Rights for Persons with Disabilities Law and the Equal Rights for Persons with Disabilities Regulations (Service Accessibility Adjustments), 5773–2013.</p>
              <p className="mt-2">The website meets the requirements of Israeli Standard IS 5568 for web content accessibility at level AA. In addition, the website has been tested against the WCAG 2.1 guidelines at level AA.</p>
              <p className="mt-2">These adjustments apply to the public pages of the site, in both Hebrew and English.</p>
            </Section>

            <Section title="Accessibility Adjustments Made">
              <p>The adjustments made to the site include, among others:</p>
              <List items={[
                'Navigation and operation of components using the keyboard.',
                'A link to skip directly to the main content.',
                'A clear focus indicator when navigating by keyboard.',
                'A semantic structure of headings, content regions and navigation components.',
                'Accessible names for buttons, links, form fields and interactive components.',
                'Text descriptions for images that carry meaning.',
                'Forms, instructions, error messages and status messages adapted for assistive technologies.',
                'Support for magnifying the display and adapting content to screens of different sizes.',
                'Suitability for use on a computer, a mobile phone and touch screens.',
                'Adaptation for right-to-left display in Hebrew and for display in English.',
                'Contrast, text size and colours chosen to allow clear reading.',
                'Support for the user preference for reduced motion and animation.',
                'Menus, frequently asked questions, the date picker and the enquiry and booking forms adapted for accessible use.',
              ]} />
            </Section>

            <Section title="Accessibility Testing Carried Out">
              <p>The accessibility of the site was tested using a combination of automated and manual testing. The testing covered, among other things, keyboard navigation, the order in which components are reached, focus visibility, accessible names, forms and interactive components, magnification of the display, adaptation of content to different screens, and testing of pages and dynamic states on the site.</p>
              <p className="mt-2">Testing was also carried out with the following assistive technologies:</p>
              <List items={[
                'The NVDA screen reader on Windows with the Microsoft Edge browser.',
                'The VoiceOver screen reader on macOS with the Safari browser.',
              ]} />
              <p className="mt-2">Testing was carried out on the public pages and the main user journeys of the site, in both Hebrew and English.</p>
            </Section>

            <Section title="Browser and Assistive Technology Compatibility">
              <p>The site is intended for use with modern, up-to-date browsers, including Google Chrome, Microsoft Edge, Mozilla Firefox and Safari. The site is built on standard web technologies, including HTML, CSS, JavaScript, SVG and WAI-ARIA.</p>
              <p className="mt-2">For the best experience, we recommend using an up-to-date version of your browser and of your assistive technology.</p>
            </Section>

            <Section title="Accessibility at Our Branches">
              <p>The SmartCar branches in Herzliya, Tel Aviv and Jerusalem are accessible to visitors.</p>
              <p className="mt-2">For detailed information about the accessibility arrangements at a particular branch, accessible routes for getting there, or an adjustment you need ahead of your visit, please contact the company office before you arrive.</p>
            </Section>

            <Section title="Accessibility Contact">
              <p>If you have encountered a difficulty using the site, or if you need a particular adjustment in order to receive the service, we would be glad to receive your enquiry and to deal with it promptly.</p>
              {contact}
              <p className="mt-3">So that we can look into your enquiry efficiently, we recommend noting the page on which you encountered the difficulty, describing the action you were trying to carry out, and stating the browser and assistive technology you were using, where relevant.</p>
              <p className="mt-3">SmartCar continues to maintain and improve the accessibility of the site as part of its commitment to providing an equal and accessible service to the public.</p>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
