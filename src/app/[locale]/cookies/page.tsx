import { localeAlternates } from '@/lib/seo';
import { OFFICE_EMAIL, OFFICE_PHONE } from '@/lib/constants';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'he' ? 'מדיניות עוגיות' : 'Cookies Policy',
    alternates: localeAlternates(locale, 'cookies'),
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

export default async function CookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isHe = locale === 'he';

  // From the shared constants, so the policy cannot drift from the rest of
  // the site the way the accessibility page's details had.
  const contact = (
    <p className="mt-3">
      {isHe ? 'דוא״ל: ' : 'Email: '}
      <a href={`mailto:${OFFICE_EMAIL}`} className="text-[#2D5F5F] underline">{OFFICE_EMAIL}</a>
      <br />
      {isHe ? 'טלפון: ' : 'Telephone: '}
      <a href={`tel:${OFFICE_PHONE}`} className="text-[#2D5F5F] underline">{OFFICE_PHONE}</a>
    </p>
  );

  return (
    <div className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 ${isHe ? 'text-right' : 'text-left'}`} dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mb-10">
        <p className="text-[#B64916] text-sm font-semibold uppercase tracking-widest mb-2">SmartCar</p>
        <h1 className="text-4xl font-black text-[#0D2B2B] mb-2">
          {isHe ? 'מדיניות עוגיות' : 'Cookies Policy'}
        </h1>
        <p className="text-gray-600 text-sm">
          {isHe ? 'עדכון אחרון: 29 ביולי 2026' : 'Last updated: July 29, 2026'}
        </p>
      </div>

      <div className="space-y-10 text-gray-700 leading-relaxed">
        {isHe ? (
          <>
            <p>SmartCar משתמשת בעוגיות ובטכנולוגיות דומות כדי להפעיל את האתר, לשמור העדפות, לאבטח טפסים, לשפר את השירות ולבחון את אופן השימוש באתר.</p>

            <Section title="מהן עוגיות?">
              <p>עוגיות הן קובצי מידע קטנים הנשמרים במכשיר בעת הגלישה באתר. האתר עשוי להשתמש גם בטכנולוגיות דומות, כגון אחסון מקומי בדפדפן, לצורך שמירת העדפות ונתונים הנחוצים להפעלת השירות.</p>
            </Section>

            <Section title="כיצד אנו משתמשים בעוגיות ובטכנולוגיות דומות?">
              <p>השימוש באתר כולל את הסוגים הבאים:</p>
              <ul className="list-disc list-inside space-y-3 mt-3">
                <li><strong>טכנולוגיות הכרחיות:</strong> נדרשות להפעלת האתר, לשמירת בחירת השפה והעדפות העוגיות, לאבטחת טפסים ולשמירת טיוטת הזמנה כדי למנוע אובדן נתונים.</li>
                {/* Vercel Web Analytics is cookieless and collects nothing this
                    policy covers, so per counsel it isn't named here — only
                    Google Analytics is, since it's the one that sets cookies. */}
                <li><strong>מדידה וניתוח:</strong> בהסכמתך, אנו עשויים לאסוף נתונים מצטברים על השימוש באתר, כגון עמודים שנצפו, מקור ההגעה, סוג המכשיר והדפדפן, באמצעות Google Analytics, המופעל רק לאחר קבלת הסכמתך ומציב עוגיות מדידה במכשירך.</li>
                <li><strong>שיווק:</strong> בכפוף להסכמתך, אנו עשויים להשתמש בטכנולוגיות מדידה ושיווק לצורך בחינת יעילותם של קמפיינים והצגת תוכן והצעות רלוונטיים. כלים אלה יופעלו רק אם וכאשר ישולבו באתר ולאחר קבלת הסכמה מתאימה.</li>
              </ul>
              <p className="mt-3">האתר משתמש גם ב־Cloudflare Turnstile לצורך הגנה על טפסים, מניעת ספאם ואבטחת השירות.</p>
            </Section>

            <Section title="בחירה ושינוי העדפות">
              <p>טכנולוגיות הכרחיות פועלות באופן אוטומטי, מכיוון שבלעדיהן חלק מהאתר לא יוכל לפעול כראוי.</p>
              <p className="mt-2">עוגיות וטכנולוגיות שאינן הכרחיות יופעלו רק לאחר בחירתך בבאנר העוגיות. ניתן לדחות אותן ולהמשיך להשתמש באתר, וכן לשנות את הבחירה בכל עת באמצעות הקישור „העדפות עוגיות” בתחתית האתר.</p>
              <p className="mt-2">ניתן גם לחסום או למחוק עוגיות דרך הגדרות הדפדפן. חסימת טכנולוגיות הכרחיות עלולה לפגוע בחלק מתכונות האתר.</p>
            </Section>

            <Section title="ספקי שירות חיצוניים">
              <p>חלק מהטכנולוגיות באתר מופעלות באמצעות ספקי שירות חיצוניים, ובהם Cloudflare ו־Google. השימוש של ספקים אלה במידע כפוף למדיניות הפרטיות ולתנאים שלהם.</p>
            </Section>

            <Section title="יצירת קשר">
              <p>לשאלות בנושא השימוש בעוגיות ובטכנולוגיות דומות ניתן לפנות אלינו:</p>
              {contact}
            </Section>
          </>
        ) : (
          <>
            <p>SmartCar uses cookies and similar technologies to operate the website, store preferences, secure forms, improve our service and understand how the site is used.</p>

            <Section title="What are cookies?">
              <p>Cookies are small files of information stored on your device while you browse the site. The site may also use similar technologies, such as browser local storage, to hold preferences and the data needed to operate the service.</p>
            </Section>

            <Section title="How we use cookies and similar technologies">
              <p>Use of the site involves the following categories:</p>
              <ul className="list-disc list-inside space-y-3 mt-3">
                <li><strong>Strictly necessary technologies:</strong> required to operate the site, to store your language choice and cookie preferences, to secure forms, and to save a booking draft so that data is not lost.</li>
                <li><strong>Measurement and analytics:</strong> with your consent, we may collect aggregated data about use of the site, such as pages viewed, referral source, device type and browser, via Google Analytics, which runs only after you have given consent and places measurement cookies on your device.</li>
                <li><strong>Marketing:</strong> subject to your consent, we may use measurement and marketing technologies to assess the effectiveness of campaigns and to present relevant content and offers. These tools will be enabled only if and when they are integrated into the site, and after appropriate consent has been obtained.</li>
              </ul>
              <p className="mt-3">The site also uses Cloudflare Turnstile to protect forms, prevent spam and secure the service.</p>
            </Section>

            <Section title="Choosing and changing your preferences">
              <p>Strictly necessary technologies operate automatically, because without them parts of the site cannot work properly.</p>
              <p className="mt-2">Cookies and technologies that are not strictly necessary are enabled only after you make a choice in the cookie banner. You may decline them and continue using the site, and you may change your choice at any time using the &quot;Cookie Preferences&quot; link in the site footer.</p>
              <p className="mt-2">You can also block or delete cookies through your browser settings. Blocking strictly necessary technologies may impair some features of the site.</p>
            </Section>

            <Section title="External service providers">
              <p>Some of the technologies on the site are operated through external service providers, including Cloudflare and Google. Their use of information is subject to their own privacy policies and terms.</p>
            </Section>

            <Section title="Contact us">
              <p>For questions about the use of cookies and similar technologies, you can contact us:</p>
              {contact}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
