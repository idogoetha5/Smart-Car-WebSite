import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'he' ? 'מדיניות עוגיות' : 'Cookies Policy' };
}

export default async function CookiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isHe = locale === 'he';

  return (
    <div className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 ${isHe ? 'text-right' : 'text-left'}`} dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mb-10">
        <p className="text-[#E8743B] text-sm font-semibold uppercase tracking-widest mb-2">SmartCar</p>
        <h1 className="text-4xl font-black text-[#0D2B2B] mb-2">
          {isHe ? 'מדיניות עוגיות' : 'Cookies Policy'}
        </h1>
        <p className="text-gray-500 text-sm">
          {isHe ? 'גרסה 2.0 — תחולה מ-1 ביוני 2026' : 'Version 2.0 — Effective June 1, 2026'}
        </p>
      </div>

      <div className="space-y-10 text-gray-700 leading-relaxed">
        {isHe ? (
          <>
            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">1. מהן עוגיות?</h2>
              <p>עוגיות (Cookies) הן קבצי טקסט קטנים המאוחסנים על מכשירך כאשר אתה מבקר באתר. הן מאפשרות לאתר לזכור פעולות שביצעת והעדפות שלך לאורך זמן. בנוסף, אנו עשויים להשתמש בטכנולוגיות דומות כגון Web Storage (localStorage / sessionStorage) ו-Pixel Tags.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">2. טבלת העוגיות — מפרט מלא</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#eef6f6]">
                      <th className="border border-gray-200 p-3 text-right">שם העוגייה</th>
                      <th className="border border-gray-200 p-3 text-right">סוג</th>
                      <th className="border border-gray-200 p-3 text-right">מטרה</th>
                      <th className="border border-gray-200 p-3 text-right">תוקף</th>
                      <th className="border border-gray-200 p-3 text-right">ניתן לביטול</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 p-3 font-mono text-xs">NEXT_LOCALE</td>
                      <td className="border border-gray-200 p-3"><span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">חיונית</span></td>
                      <td className="border border-gray-200 p-3">שמירת שפת הממשק (עברית/אנגלית) שנבחרה</td>
                      <td className="border border-gray-200 p-3">שנה</td>
                      <td className="border border-gray-200 p-3">לא</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 p-3 font-mono text-xs">admin_auth</td>
                      <td className="border border-gray-200 p-3"><span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">חיונית</span></td>
                      <td className="border border-gray-200 p-3">אימות מנהל מערכת (httpOnly, Secure)</td>
                      <td className="border border-gray-200 p-3">סשן</td>
                      <td className="border border-gray-200 p-3">לא</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-3 font-mono text-xs">booking_draft_*</td>
                      <td className="border border-gray-200 p-3"><span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">חיונית</span></td>
                      <td className="border border-gray-200 p-3">שמירת טיוטת הזמנה ב-localStorage למניעת אובדן נתונים</td>
                      <td className="border border-gray-200 p-3">עד שליחת הזמנה</td>
                      <td className="border border-gray-200 p-3">כן (ידנית)</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 p-3 font-mono text-xs">va_* (Vercel Analytics)</td>
                      <td className="border border-gray-200 p-3"><span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">ביצועים</span></td>
                      <td className="border border-gray-200 p-3">ניתוח תנועה אנונימי — לא כולל PII. מופעל על ידי Vercel Inc. <strong>פועל רק לאחר אישור.</strong></td>
                      <td className="border border-gray-200 p-3">24 שעות</td>
                      <td className="border border-gray-200 p-3">כן</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-3 font-mono text-xs">_ga, _gid (Google Analytics)</td>
                      <td className="border border-gray-200 p-3"><span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">ביצועים</span></td>
                      <td className="border border-gray-200 p-3">ניתוח שימוש באתר. <strong>לא מופעל בשלב זה.</strong></td>
                      <td className="border border-gray-200 p-3">—</td>
                      <td className="border border-gray-200 p-3">—</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 p-3 font-mono text-xs">עוגיות שיווקיות צד שלישי</td>
                      <td className="border border-gray-200 p-3"><span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full text-xs">שיווקיות</span></td>
                      <td className="border border-gray-200 p-3">פרסום ממוקד. <strong>לא מופעל בשלב זה.</strong></td>
                      <td className="border border-gray-200 p-3">—</td>
                      <td className="border border-gray-200 p-3">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-500 mt-3">* "לא מופעל בשלב זה" — אנו מחויבים לעדכן מסמך זה <strong>לפני</strong> הפעלת כל עוגייה חדשה.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">3. הסכמה וניהול עוגיות</h2>
              <p className="mb-3">עוגיות חיוניות מופעלות אוטומטית ואינן דורשות הסכמה. עוגיות ביצועים ושיווקיות פועלות רק לאחר קבלת הסכמה מפורשת (לחיצה על "אישור" בבאנר העוגיות).</p>
              <p className="mb-3">ניתן לשנות את העדפות ההסכמה בכל עת — לחץ על "העדפות עוגיות" בתחתית כל עמוד.</p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                <strong>שים לב:</strong> ביטול עוגיות חיוניות עלול למנוע גישה לחלקים מהאתר, לרבות טופס ההזמנה.
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">4. כיצד לנהל עוגיות בדפדפן</h2>
              <ul className="list-disc list-inside space-y-2 mr-4 text-sm">
                <li><strong>Chrome:</strong> הגדרות › פרטיות ואבטחה › עוגיות ונתוני אתרים אחרים</li>
                <li><strong>Firefox:</strong> הגדרות › פרטיות ואבטחה › עוגיות ונתוני אתרים</li>
                <li><strong>Safari:</strong> העדפות › פרטיות</li>
                <li><strong>Edge:</strong> הגדרות › עוגיות והרשאות אתר</li>
              </ul>
              <p className="mt-3 text-sm text-gray-500">למחיקת נתוני localStorage (טיוטת הזמנה): בדפדפן, פתח כלי מפתח (F12) › Application › Local Storage › smartcar.co.il › מחק שורות booking_draft_*.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">5. קישורים לספקי צד שלישי</h2>
              <ul className="list-disc list-inside space-y-2 mr-4 text-sm">
                <li>Vercel Analytics: <a href="https://vercel.com/legal/privacy-policy" className="text-[#2D5F5F] underline" target="_blank" rel="noopener noreferrer">vercel.com/legal/privacy-policy</a></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">6. יצירת קשר</h2>
              <p>📧 <a href="mailto:office@smartcar.co.il" className="text-[#2D5F5F] underline">office@smartcar.co.il</a></p>
            </section>
          </>
        ) : (
          <>
            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">1. What Are Cookies?</h2>
              <p>Cookies are small text files stored on your device when you visit a website. They allow the site to remember your actions and preferences over time. We may also use similar technologies such as Web Storage (localStorage / sessionStorage) and Pixel Tags.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">2. Cookie Register — Full Specification</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-[#eef6f6]">
                      <th className="border border-gray-200 p-3 text-left">Cookie Name</th>
                      <th className="border border-gray-200 p-3 text-left">Category</th>
                      <th className="border border-gray-200 p-3 text-left">Purpose</th>
                      <th className="border border-gray-200 p-3 text-left">Expiry</th>
                      <th className="border border-gray-200 p-3 text-left">Can Opt Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 p-3 font-mono text-xs">NEXT_LOCALE</td>
                      <td className="border border-gray-200 p-3"><span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">Essential</span></td>
                      <td className="border border-gray-200 p-3">Stores selected language (Hebrew/English)</td>
                      <td className="border border-gray-200 p-3">1 year</td>
                      <td className="border border-gray-200 p-3">No</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 p-3 font-mono text-xs">admin_auth</td>
                      <td className="border border-gray-200 p-3"><span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">Essential</span></td>
                      <td className="border border-gray-200 p-3">Admin authentication (httpOnly, Secure)</td>
                      <td className="border border-gray-200 p-3">Session</td>
                      <td className="border border-gray-200 p-3">No</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-3 font-mono text-xs">cf_clearance, _cf_bm (Cloudflare Turnstile)</td>
                      <td className="border border-gray-200 p-3"><span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">Essential</span></td>
                      <td className="border border-gray-200 p-3">Bot protection on booking, contact and review forms. Operated by Cloudflare Inc.</td>
                      <td className="border border-gray-200 p-3">30 min – 24 hours</td>
                      <td className="border border-gray-200 p-3">No</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 p-3 font-mono text-xs">booking_draft_*</td>
                      <td className="border border-gray-200 p-3"><span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">Essential</span></td>
                      <td className="border border-gray-200 p-3">Saves booking form draft in localStorage to prevent data loss</td>
                      <td className="border border-gray-200 p-3">Until booking submitted</td>
                      <td className="border border-gray-200 p-3">Yes (manually)</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 p-3 font-mono text-xs">va_* (Vercel Analytics)</td>
                      <td className="border border-gray-200 p-3"><span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">Performance</span></td>
                      <td className="border border-gray-200 p-3">Anonymous traffic analysis — no PII. Operated by Vercel Inc.</td>
                      <td className="border border-gray-200 p-3">24 hours</td>
                      <td className="border border-gray-200 p-3">Yes</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-3 font-mono text-xs">Third-party marketing cookies</td>
                      <td className="border border-gray-200 p-3"><span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full text-xs">Marketing</span></td>
                      <td className="border border-gray-200 p-3">Targeted advertising. <strong>Not currently active.</strong></td>
                      <td className="border border-gray-200 p-3">—</td>
                      <td className="border border-gray-200 p-3">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-500 mt-3">* "Not currently active" — we commit to updating this document <strong>before</strong> activating any new cookie.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">3. Consent & Cookie Management</h2>
              <p>Essential cookies are activated automatically and do not require consent. Performance and marketing cookies are activated only after you provide explicit consent via the cookie banner. You may change your consent preferences at any time via "Cookie Preferences" in the footer.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">4. Managing Cookies in Your Browser</h2>
              <ul className="list-disc list-inside space-y-2 ml-4 text-sm">
                <li><strong>Chrome:</strong> Settings › Privacy and security › Cookies and other site data</li>
                <li><strong>Firefox:</strong> Settings › Privacy & Security › Cookies and Site Data</li>
                <li><strong>Safari:</strong> Preferences › Privacy</li>
                <li><strong>Edge:</strong> Settings › Cookies and site permissions</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">5. Third-Party Links</h2>
              <ul className="list-disc list-inside space-y-2 ml-4 text-sm">
                <li>Vercel Analytics: <a href="https://vercel.com/legal/privacy-policy" className="text-[#2D5F5F] underline" target="_blank" rel="noopener noreferrer">vercel.com/legal/privacy-policy</a></li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">6. Contact</h2>
              <p>📧 <a href="mailto:office@smartcar.co.il" className="text-[#2D5F5F] underline">office@smartcar.co.il</a></p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
