import { localeAlternates } from '@/lib/seo';
import LegalContact from '@/components/legal/LegalContact';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'he' ? 'מדיניות פרטיות' : 'Privacy Policy',
    description:
      locale === 'he'
        ? 'מדיניות הפרטיות של SmartCar: איזה מידע נאסף, לשם מה, למי הוא נמסר וכיצד לממש את זכויותיכם.'
        : "SmartCar's Privacy Policy: what information is collected, why, who it is shared with and how to exercise your rights.",
    alternates: localeAlternates(locale, 'privacy'),
  };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isHe = locale === 'he';

  return (
    <div className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 ${isHe ? 'text-right' : 'text-left'}`} dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mb-10">
        <p className="text-[#B64916] text-sm font-semibold uppercase tracking-widest mb-2">SmartCar</p>
        <h1 className="text-4xl font-black text-[#0D2B2B] mb-2">
          {isHe ? 'מדיניות פרטיות' : 'Privacy Policy'}
        </h1>
        <p className="text-gray-600 text-sm">
          {isHe ? 'גרסה 2.0 — תחולה מ-1 ביוני 2026' : 'Version 2.0 — Effective June 1, 2026'}
        </p>
      </div>

      <div className="space-y-10 text-gray-700 leading-relaxed">
        {isHe ? (
          <>
            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">1. מי אנחנו</h2>
              <p>SmartCar (להלן: "החברה") היא מפעילת שירותי השכרת רכב וליסינג הפועלת בישראל.</p>
              <p className="mt-2">לשאלות בנושא פרטיות ולמימוש זכויות לפי חוק הגנת הפרטיות ניתן לפנות אלינו: <a href="mailto:office@smartcar.co.il" className="text-[#2D5F5F] underline">office@smartcar.co.il</a></p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">2. מידע שנאסף, בסיס חוקי ותקופת שמירה</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#eef6f6]">
                      <th className="border border-gray-200 p-3 text-right">סוג המידע</th>
                      <th className="border border-gray-200 p-3 text-right">מטרת האיסוף</th>
                      <th className="border border-gray-200 p-3 text-right">בסיס חוקי</th>
                      <th className="border border-gray-200 p-3 text-right">תקופת שמירה</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 p-3">שם, אימייל, טלפון</td>
                      <td className="border border-gray-200 p-3">עיבוד הזמנות, יצירת קשר</td>
                      <td className="border border-gray-200 p-3">ביצוע חוזה</td>
                      <td className="border border-gray-200 p-3">7 שנים (חובת דיווח כספי)</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 p-3">מספר ת.ז. / דרכון</td>
                      <td className="border border-gray-200 p-3">אימות זהות, דרישות חוק</td>
                      <td className="border border-gray-200 p-3">חובה חוקית</td>
                      <td className="border border-gray-200 p-3">7 שנים</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-3">פרטי רישיון נהיגה</td>
                      <td className="border border-gray-200 p-3">בדיקת כשירות לנהיגה</td>
                      <td className="border border-gray-200 p-3">ביצוע חוזה / אינטרס לגיטימי</td>
                      <td className="border border-gray-200 p-3">7 שנים</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-3">נתוני גלישה (IP, דפדפן)</td>
                      <td className="border border-gray-200 p-3">אבטחה, ניתוח שימוש</td>
                      <td className="border border-gray-200 p-3">אינטרס לגיטימי</td>
                      <td className="border border-gray-200 p-3">90 יום</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 p-3">תכתובות ופניות לקוח</td>
                      <td className="border border-gray-200 p-3">תיעוד שירות לקוחות</td>
                      <td className="border border-gray-200 p-3">אינטרס לגיטימי</td>
                      <td className="border border-gray-200 p-3">3 שנים</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-3">כתובת דוא"ל לשיווק</td>
                      <td className="border border-gray-200 p-3">מבצעים, עדכונים (בהסכמה בלבד)</td>
                      <td className="border border-gray-200 p-3">הסכמה</td>
                      <td className="border border-gray-200 p-3">עד ביטול הסכמה</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-600 mt-3">אנו לא אוספים נתונים ביומטריים, נתוני בריאות, נתוני גזע, נתוני עמדות פוליטיות, או נתוני קטינים מתחת לגיל 18.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">3. שיתוף מידע עם צדדים שלישיים</h2>
              <p className="mb-3">אנו <strong>לא מוכרים, מחכירים או סוחרים</strong> במידע אישי. מידע עשוי להיות משותף רק עם הגורמים הבאים ולמטרות המפורטות:</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#eef6f6]">
                      <th className="border border-gray-200 p-3 text-right">גורם שלישי</th>
                      <th className="border border-gray-200 p-3 text-right">מטרה</th>
                      <th className="border border-gray-200 p-3 text-right">מדינה</th>
                      <th className="border border-gray-200 p-3 text-right">בטוחות</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 p-3">Supabase Inc.</td>
                      <td className="border border-gray-200 p-3">אחסון מסד נתונים</td>
                      <td className="border border-gray-200 p-3">ארה"ב / AWS</td>
                      <td className="border border-gray-200 p-3">DPA + SOC 2 Type II</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 p-3">Vercel Inc.</td>
                      <td className="border border-gray-200 p-3">אחסון אתר, CDN, אנליטיקס</td>
                      <td className="border border-gray-200 p-3">ארה"ב / גלובלי</td>
                      <td className="border border-gray-200 p-3">DPA + SOC 2</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-3">EmailJS</td>
                      <td className="border border-gray-200 p-3">שליחת מיילי אישור</td>
                      <td className="border border-gray-200 p-3">ארה"ב</td>
                      <td className="border border-gray-200 p-3">DPA</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 p-3">Resend</td>
                      <td className="border border-gray-200 p-3">שליחת מיילי הצעות מחיר</td>
                      <td className="border border-gray-200 p-3">ארה"ב</td>
                      <td className="border border-gray-200 p-3">DPA</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-3">Google Analytics</td>
                      <td className="border border-gray-200 p-3">ניתוח שימוש באתר (רק בהסכמה)</td>
                      <td className="border border-gray-200 p-3">ארה"ב / גלובלי</td>
                      <td className="border border-gray-200 p-3">DPA + SCCs</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 p-3">Cloudflare (Turnstile)</td>
                      <td className="border border-gray-200 p-3">הגנה מפני בוטים בטפסים</td>
                      <td className="border border-gray-200 p-3">גלובלי</td>
                      <td className="border border-gray-200 p-3">DPA</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-3">Upstash</td>
                      <td className="border border-gray-200 p-3">הגבלת קצב בקשות, תשתית תור</td>
                      <td className="border border-gray-200 p-3">ארה"ב</td>
                      <td className="border border-gray-200 p-3">DPA</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 p-3">חברות ביטוח</td>
                      <td className="border border-gray-200 p-3">כיסוי ביטוחי לתאונות</td>
                      <td className="border border-gray-200 p-3">ישראל</td>
                      <td className="border border-gray-200 p-3">חוק ישראלי</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-3">רשויות מדינה</td>
                      <td className="border border-gray-200 p-3">דרישת חוק בלבד</td>
                      <td className="border border-gray-200 p-3">ישראל</td>
                      <td className="border border-gray-200 p-3">צו שיפוטי / חוקי</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">4. שיווק ישיר — הסכמה ביטול</h2>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>אנו שולחים תקשורת שיווקית (מבצעים, עדכונים) <strong>רק לאחר קבלת הסכמה מפורשת</strong> בטופס הרשמה נפרד.</li>
                <li>ביטול הסכמה: בכל עת, באמצעות לחיצה על "הסר מרשימת התפוצה" בתחתית כל מייל, או בפנייה ל-<a href="mailto:office@smartcar.co.il" className="text-[#2D5F5F] underline">office@smartcar.co.il</a>.</li>
                <li>ביטול הסכמה לשיווק אינו משפיע על עיבוד המידע לצורך ביצוע חוזה שכירות קיים.</li>
                <li>מיילי אישור הזמנה ועסקה <strong>אינם</strong> שיווקיים ואינם מצריכים הסכמה.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">5. זכויותיך לפי חוק הגנת הפרטיות הישראלי</h2>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li><strong>זכות עיון:</strong> לקבל עותק של המידע המוחזק עליך תוך 30 יום מהבקשה.</li>
                <li><strong>זכות תיקון:</strong> לדרוש תיקון מידע שגוי, לא מדויק, חסר או מטעה.</li>
                <li><strong>זכות מחיקה:</strong> לדרוש מחיקת מידע שאין עוד חובה חוקית לשמרו (כפוף לתקופות שמירה המפורטות בסעיף 2).</li>
                <li><strong>זכות הגבלת עיבוד:</strong> לדרוש הגבלת שימוש במידע במהלך בדיקת תלונה.</li>
                <li><strong>זכות ניידות:</strong> לקבל את המידע שלך בפורמט מקריא מכונה (CSV/JSON).</li>
                <li><strong>זכות התנגדות:</strong> להתנגד לעיבוד מידע לצרכי שיווק ישיר — ללא תנאים.</li>
              </ul>
              <p className="mt-3 text-sm">לממש זכויות אלו, שלח בקשה בכתב ל-<a href="mailto:office@smartcar.co.il" className="text-[#2D5F5F] underline">office@smartcar.co.il</a>. נשיב תוך 30 יום.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">6. אבטחת מידע</h2>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>כל תקשורת מוצפנת באמצעות TLS 1.3.</li>
                <li>גישה למידע מוגבלת לעובדים המורשים בלבד, לפי עיקרון "הצורך לדעת".</li>
                <li>במקרה של אירוע אבטחה חמור — נדווח על כך לרשות להגנת הפרטיות באופן מיידי מרגע גילוי האירוע, בהתאם לתקנות הגנת הפרטיות (אבטחת מידע), התשע"ז-2017, ונודיע לנפגעים ככל שנדרש בדין.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">7. העברות מידע בינלאומיות</h2>
              <p>חלק מספקי השירות שלנו (Supabase, Vercel, EmailJS, Resend, Google Analytics, Cloudflare, Upstash) מאחסנים מידע מחוץ לישראל. הבטחנו שכל ספק חתם על הסכם עיבוד נתונים (DPA) עם הגנות מספקות, בהתאם לסטנדרטים המקבילים לחקיקה האירופית (GDPR Adequacy / SCCs).</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">8. עוגיות</h2>
              <p>ראה <a href="./cookies" className="text-[#2D5F5F] underline">מדיניות העוגיות</a> המלאה שלנו לפרטים על סוגי העוגיות, מטרותיהן ואופן ניהולן.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">9. שינויים במדיניות</h2>
              <p>שינויים מהותיים יפורסמו באתר 14 יום לפני כניסתם לתוקף. שינויים הנדרשים על פי חוק עשויים להיכנס לתוקף מיידי. תאריך עדכון ה"גרסה" בראש המסמך משקף את מועד השינוי האחרון.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">10. פנייה לרשות</h2>
              <p>אם אינך מרוצה מטיפולנו בפנייתך, תוכל להגיש תלונה לרשות להגנת הפרטיות בישראל: <a href="https://www.gov.il/he/departments/the_privacy_protection_authority" className="text-[#2D5F5F] underline" target="_blank" rel="noopener noreferrer">gov.il/departments/privacy</a></p>
            </section>

            <LegalContact topic="privacy" locale={locale} />
          </>
        ) : (
          <>
            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">1. Who We Are</h2>
              <p>SmartCar ("the Company") operates car rental and leasing services in Israel. For privacy questions or to exercise your rights, contact us at <a href="mailto:office@smartcar.co.il" className="text-[#2D5F5F] underline">office@smartcar.co.il</a>.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">2. Data We Collect, Legal Basis & Retention</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#eef6f6]">
                      <th className="border border-gray-200 p-3 text-left">Data Type</th>
                      <th className="border border-gray-200 p-3 text-left">Purpose</th>
                      <th className="border border-gray-200 p-3 text-left">Legal Basis</th>
                      <th className="border border-gray-200 p-3 text-left">Retention Period</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td className="border border-gray-200 p-3">Name, email, phone</td><td className="border border-gray-200 p-3">Processing bookings, contact</td><td className="border border-gray-200 p-3">Contract performance</td><td className="border border-gray-200 p-3">7 years (statutory)</td></tr>
                    <tr className="bg-gray-50"><td className="border border-gray-200 p-3">ID / Passport number</td><td className="border border-gray-200 p-3">Identity verification</td><td className="border border-gray-200 p-3">Legal obligation</td><td className="border border-gray-200 p-3">7 years</td></tr>
                    <tr><td className="border border-gray-200 p-3">Driving licence details</td><td className="border border-gray-200 p-3">Eligibility verification</td><td className="border border-gray-200 p-3">Contract / legitimate interest</td><td className="border border-gray-200 p-3">7 years</td></tr>
                    <tr><td className="border border-gray-200 p-3">Browsing data (IP, browser)</td><td className="border border-gray-200 p-3">Security, analytics</td><td className="border border-gray-200 p-3">Legitimate interest</td><td className="border border-gray-200 p-3">90 days</td></tr>
                    <tr className="bg-gray-50"><td className="border border-gray-200 p-3">Marketing email address</td><td className="border border-gray-200 p-3">Offers & updates (consent only)</td><td className="border border-gray-200 p-3">Consent</td><td className="border border-gray-200 p-3">Until consent is withdrawn</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-600 mt-3">We do not collect biometric data, health data, racial data, political opinions, or data from persons under 18.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">3. Third-Party Data Sharing</h2>
              <p className="mb-3">We <strong>never sell, rent or trade</strong> personal data. Data may be shared only with the following parties for the stated purposes:</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#eef6f6]">
                      <th className="border border-gray-200 p-3 text-left">Third Party</th>
                      <th className="border border-gray-200 p-3 text-left">Purpose</th>
                      <th className="border border-gray-200 p-3 text-left">Country</th>
                      <th className="border border-gray-200 p-3 text-left">Safeguards</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td className="border border-gray-200 p-3">Supabase Inc.</td><td className="border border-gray-200 p-3">Database hosting</td><td className="border border-gray-200 p-3">USA / AWS</td><td className="border border-gray-200 p-3">DPA + SOC 2 Type II</td></tr>
                    <tr className="bg-gray-50"><td className="border border-gray-200 p-3">Vercel Inc.</td><td className="border border-gray-200 p-3">Website hosting, CDN, analytics</td><td className="border border-gray-200 p-3">USA / Global</td><td className="border border-gray-200 p-3">DPA + SOC 2</td></tr>
                    <tr><td className="border border-gray-200 p-3">EmailJS</td><td className="border border-gray-200 p-3">Confirmation emails</td><td className="border border-gray-200 p-3">USA</td><td className="border border-gray-200 p-3">DPA</td></tr>
                    <tr className="bg-gray-50"><td className="border border-gray-200 p-3">Resend</td><td className="border border-gray-200 p-3">Quotation emails</td><td className="border border-gray-200 p-3">USA</td><td className="border border-gray-200 p-3">DPA</td></tr>
                    <tr><td className="border border-gray-200 p-3">Google Analytics</td><td className="border border-gray-200 p-3">Site usage analytics (consent-gated)</td><td className="border border-gray-200 p-3">USA / Global</td><td className="border border-gray-200 p-3">DPA + SCCs</td></tr>
                    <tr className="bg-gray-50"><td className="border border-gray-200 p-3">Cloudflare (Turnstile)</td><td className="border border-gray-200 p-3">Bot protection on forms</td><td className="border border-gray-200 p-3">Global</td><td className="border border-gray-200 p-3">DPA</td></tr>
                    <tr><td className="border border-gray-200 p-3">Upstash</td><td className="border border-gray-200 p-3">Request rate limiting, queue infrastructure</td><td className="border border-gray-200 p-3">USA</td><td className="border border-gray-200 p-3">DPA</td></tr>
                    <tr className="bg-gray-50"><td className="border border-gray-200 p-3">Insurance companies</td><td className="border border-gray-200 p-3">Accident insurance coverage</td><td className="border border-gray-200 p-3">Israel</td><td className="border border-gray-200 p-3">Israeli law</td></tr>
                    <tr><td className="border border-gray-200 p-3">Government authorities</td><td className="border border-gray-200 p-3">Legal obligation only</td><td className="border border-gray-200 p-3">Israel</td><td className="border border-gray-200 p-3">Court order / statutory</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">4. Direct Marketing — Consent & Opt-Out</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>We send marketing communications (offers, updates) <strong>only after obtaining explicit consent</strong> through a separate sign-up form.</li>
                <li>Withdraw consent at any time via the &quot;unsubscribe&quot; link at the bottom of every email, or by contacting <a href="mailto:office@smartcar.co.il" className="text-[#2D5F5F] underline">office@smartcar.co.il</a>.</li>
                <li>Withdrawing marketing consent does not affect processing needed to perform an existing rental contract.</li>
                <li>Booking and transaction confirmation emails are <strong>not</strong> marketing and do not require consent.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">5. Your Rights</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Right of access:</strong> Receive a copy of data held about you within 30 days.</li>
                <li><strong>Right of rectification:</strong> Have inaccurate, incomplete or misleading data corrected.</li>
                <li><strong>Right to erasure:</strong> Request deletion of data where no statutory retention obligation applies.</li>
                <li><strong>Right to restriction:</strong> Restrict processing while a complaint is under review.</li>
                <li><strong>Right to portability:</strong> Receive your data in machine-readable format (CSV/JSON).</li>
                <li><strong>Right to object:</strong> Object to direct marketing processing — no conditions apply.</li>
              </ul>
              <p className="mt-3 text-sm">To exercise any right, send a written request to <a href="mailto:office@smartcar.co.il" className="text-[#2D5F5F] underline">office@smartcar.co.il</a>. We will respond within 30 days.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">6. Security</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>All communications are encrypted using TLS 1.3.</li>
                <li>Data access is limited to authorised personnel on a need-to-know basis.</li>
                <li>In the event of a severe security incident, we will notify the Israeli Privacy Protection Authority immediately upon discovery, in accordance with the Protection of Privacy Regulations (Data Security), 5777-2017, and will notify affected individuals as required by law.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">7. International Data Transfers</h2>
              <p>Some of our service providers (Supabase, Vercel, EmailJS, Resend, Google Analytics, Cloudflare, Upstash) store data outside Israel. We have ensured each provider has signed a Data Processing Agreement (DPA) with protections equivalent to European standards (GDPR Adequacy / SCCs).</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">8. Cookies</h2>
              <p>See our full <a href="./cookies" className="text-[#2D5F5F] underline">Cookie Policy</a> for details on the types of cookies we use, their purposes and how to manage them.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">9. Changes to This Policy</h2>
              <p>Material changes will be published on the site 14 days before taking effect. Changes required by law may take effect immediately. The &quot;Version&quot; date at the top of this document reflects the date of the last change.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">10. Complaints to the Authority</h2>
              <p>If you are not satisfied with how we have handled your request, you may file a complaint with the Israeli Privacy Protection Authority: <a href="https://www.gov.il/he/departments/the_privacy_protection_authority" className="text-[#2D5F5F] underline" target="_blank" rel="noopener noreferrer">gov.il/departments/privacy</a></p>
            </section>

            <LegalContact topic="privacy" locale={locale} />
          </>
        )}
      </div>
    </div>
  );
}
