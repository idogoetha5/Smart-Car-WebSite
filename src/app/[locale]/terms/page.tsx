import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === 'he' ? 'תנאי שימוש ושכירות' : 'Terms of Service & Rental Conditions' };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isHe = locale === 'he';

  return (
    <div className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 ${isHe ? 'text-right' : 'text-left'}`} dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mb-10">
        <p className="text-[#E8743B] text-sm font-semibold uppercase tracking-widest mb-2">SmartCar</p>
        <h1 className="text-4xl font-black text-[#0D2B2B] mb-2">
          {isHe ? 'תנאי שימוש ושכירות' : 'Terms of Service & Rental Conditions'}
        </h1>
        <p className="text-gray-500 text-sm">
          {isHe ? 'גרסה 2.0 — תחולה מ-1 ביוני 2026' : 'Version 2.0 — Effective June 1, 2026'}
        </p>
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          {isHe
            ? 'מסמך זה מהווה חוזה מחייב. קרא אותו במלואו לפני ביצוע הזמנה. ביצוע הזמנה מהווה הסכמה מפורשת לכל התנאים המפורטים להלן.'
            : 'This document constitutes a binding contract. Read it in full before making a reservation. Completing a reservation constitutes express agreement to all terms stated herein.'}
        </div>
      </div>

      <div className="space-y-10 text-gray-700 leading-relaxed">
        {isHe ? (
          <>
            {/* ─── HEBREW ─────────────────────────────────────────── */}
            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">1. הגדרות</h2>
              <ul className="list-none space-y-2 text-sm">
                <li><strong>"SmartCar" / "החברה"</strong> — חברת SmartCar (ח.פ. / ע.מ.), המפעילה שירותי השכרת רכב וליסינג בישראל.</li>
                <li><strong>"שוכר"</strong> — כל אדם שהזמין ו/או חתם על חוזה שכירות עם החברה.</li>
                <li><strong>"נהג נוסף"</strong> — כל אדם המורשה לנהוג ברכב השכור מעבר לשוכר הראשי.</li>
                <li><strong>"תקופת השכירות"</strong> — מועד האיסוף הנקוב בחוזה עד מועד ההחזרה הנקוב בחוזה.</li>
                <li><strong>"נזק"</strong> — כל פגיעה גופנית, חומרית, מכנית, אסתטית או אחרת ברכב, לרבות זיהום פנים וריח עישון.</li>
                <li><strong>"כוח עליון"</strong> — אירוע בלתי צפוי מחוץ לשליטת החברה: מלחמה, שביתה, צו שלטוני, פגע טבע, מגפה, תאונת דרכים מוצדקת.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">2. כשירות לשכירות — תנאים מחייבים</h2>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li><strong>גיל מינימלי:</strong> 21 שנים. לרכבים מסוגים LUXURY, SUV, VAN — 23 שנים.</li>
                <li><strong>ותק רישיון:</strong> לפחות 24 חודשים רציפים ממועד הוצאת הרישיון.</li>
                <li><strong>רישיון בתוקף:</strong> חייב להיות תקף לאורך כל תקופת השכירות.</li>
                <li><strong>תייר/תושב חוץ:</strong> נדרש רישיון נהיגה בינלאומי בנוסף לרישיון הלאומי, או רישיון נהיגה מארץ מוצא שהוכר על ידי ישראל.</li>
                <li><strong>בטחון כספי:</strong> כרטיס אשראי בתוקף על שם השוכר לחיוב פיקדון. כרטיס דביט אינו מתקבל.</li>
                <li>שוכר שלא יוכיח עמידה בתנאים לעיל במועד האיסוף — החברה תהא רשאית לבטל את ההזמנה ללא החזר כספי.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">3. פיקדון ותשלום</h2>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>פיקדון יוחזר תוך 14 ימי עסקים מהחזרת הרכב בתנאי שלא נמצא נזק.</li>
                <li>דמי השכירות יחויבו במלואם לפני מסירת הרכב.</li>
                <li>גובה הפיקדון האינדיקטיבי לפי קטגוריה: כלכלה — ₪1,000 | קומפקטי/סדאן/חשמלי — ₪1,500 | SUV/ואן/קבריולט — ₪2,000–₪2,500 | יוקרה — ₪3,000. <strong>הסכום הסופי ייקבע בחוזה הכתוב ויאושר על ידי נציג SmartCar.</strong></li>
                <li>החברה רשאית לנכות מהפיקדון: דמי נזק, עלויות ניקוי, דלק חסר, דוחות/קנסות שהגיעו בתקופת השכירות.</li>
                <li>חיוב נוסף מעבר לפיקדון ייעשה בהודעה מראש בכתב.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">4. ביטול, שינוי הזמנה והחזרים</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm mt-2">
                  <thead>
                    <tr className="bg-[#eef6f6]">
                      <th className="border border-gray-200 p-3 text-right">מועד הביטול</th>
                      <th className="border border-gray-200 p-3 text-right">עמלת ביטול</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td className="border border-gray-200 p-3">יותר מ-72 שעות לפני האיסוף</td><td className="border border-gray-200 p-3">ללא חיוב — החזר מלא</td></tr>
                    <tr><td className="border border-gray-200 p-3">72–48 שעות לפני האיסוף</td><td className="border border-gray-200 p-3">25% מסך דמי השכירות הבסיסיים</td></tr>
                    <tr><td className="border border-gray-200 p-3">48–24 שעות לפני האיסוף</td><td className="border border-gray-200 p-3">50% מסך דמי השכירות הבסיסיים</td></tr>
                    <tr><td className="border border-gray-200 p-3">פחות מ-24 שעות / אי-הופעה</td><td className="border border-gray-200 p-3">100% — ללא החזר</td></tr>
                  </tbody>
                </table>
              </div>
              <ul className="list-disc list-inside space-y-2 mr-4 mt-4 text-sm">
                <li>"דמי שכירות בסיסיים" = מחיר הרכב בלבד, לא כולל תוספות שנרכשו.</li>
                <li>שינוי תאריכים ללא תוספת חיוב אפשרי עד 48 שעות לפני האיסוף, בכפוף לזמינות.</li>
                <li>ביטולים עקב כוח עליון מזכים בזיכוי לשימוש עתידי בלבד, לא בהחזר כספי.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">5. זמינות רכב — מה קורה אם הרכב אינו זמין</h2>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>החברה תעשה מאמץ סביר לספק רכב מאותה קטגוריה שהוזמנה.</li>
                <li>אם לא יהיה רכב זמין מהקטגוריה שהוזמנה — יוצע לשוכר <strong>רכב מקטגוריה גבוהה יותר</strong> ללא תוספת תשלום.</li>
                <li>אם לא יהיה כל רכב זמין — השוכר יהיה זכאי ל<strong>החזר מלא</strong> של הסכום ששולם, ללא פיצוי נוסף.</li>
                <li>החברה לא תישא באחריות לנזקים עקיפים (הפסד הכנסה, הוצאות נסיעה חלופית) כתוצאה מאי-זמינות רכב.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">6. שימוש ברכב — חובות השוכר</h2>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>אסור לנהוג ברכב בהשפעת אלכוהול, סמים, או תרופות המשפיעות על הנהיגה.</li>
                <li>אסורה נסיעה מחוץ לגבולות מדינת ישראל ללא אישור מוקדם בכתב. הפרה תבטל כל כיסוי ביטוחי.</li>
                <li>עישון בתוך הרכב אסור. זיהום עקב עישון יגרור חיוב ניקוי מינימלי של ₪500.</li>
                <li>הרכב נמסר עם מיכל דלק מלא ויש להחזירו עם מיכל מלא. אי-החזרת דלק מלא תחויב לפי מחיר שוק.</li>
                <li><strong>מגבלת ק"מ:</strong> מכסת הנסיעה נקבעת לפי אורך השכירות: 1–7 ימים — 250 ק"מ ליום; 8–30 ימים — 220 ק"מ ליום; מעל 30 ימים — 4,000 ק"מ לכל 30 יום. ק"מ חריגים מעבר למכסה יחויבו לפי התעריף הקבוע בחוזה ההשכרה.</li>
                <li>חל איסור על שימוש ברכב לצרכי שכר — מוניות, Uber, Bolt, או כל שירות תחבורה בתשלום.</li>
                <li>חל איסור על גרירת כלי רכב, נגרר או ציוד כבד ללא אישור מפורש בכתב.</li>
                <li>השוכר חייב לנעול את הרכב, לשמור על המפתחות ולדאוג לאבטחה סבירה.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">7. נזקים, תאונות וגניבה</h2>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li><strong>בדיקת הרכב:</strong> השוכר חייב לבדוק את הרכב במועד האיסוף ולחתום על דוח מצב ראשוני. נזק שלא צוין בדוח ייחשב כנזק שנגרם בתקופת השכירות.</li>
                <li><strong>תאונה:</strong> חובה לדווח לחברה תוך שעה מהאירוע ולמלא דוח תאונה. אי-דיווח מבטל כיסוי ביטוחי.</li>
                <li><strong>גניבה:</strong> חובה להגיש תלונה במשטרה תוך שעתיים ולמסור למשרד העתק. אחריות השוכר במקרה גניבה מוגבלת לגובה הפיקדון בלבד, בכפוף לביטוח תקף.</li>
                <li><strong>השתתפות עצמית:</strong> גובה ההשתתפות העצמית בנזק מוגדר בחוזה ההשכרה הספציפי ולפי חבילת הביטוח שנרכשה. רכישת "ביטול השתתפות עצמית" מאפסת את ההשתתפות לאפס בנזקים מסוג A (לא כולל נזק במתכוון, DUI, נהיגה מחוץ לישראל).</li>
                <li>נזק שנגרם עקב הפרה מכוונת של תנאי החוזה — האחריות המלאה חלה על השוכר, ללא מגבלה.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">8. דוחות, קנסות ועיצומים</h2>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>כל דוח, קנס או עיצום שנגרם בתקופת השכירות חל על השוכר בלבד.</li>
                <li>דוחות חניה ומהירות שיגיעו לחברה לאחר החזרת הרכב — יועברו לשוכר בדואר רשום.</li>
                <li>אי-תשלום קנסות תוך 30 יום ממסירתם לשוכר — יישאו ריבית פיגורים חוקית.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">9. הגבלת אחריות החברה</h2>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>אחריות החברה כלפי השוכר בכל עילה שהיא, מוגבלת לגובה דמי השכירות ששולמו בפועל עבור אותה הזמנה.</li>
                <li>החברה לא תישא באחריות לנזקים עקיפים, תוצאתיים, אבדן הכנסה, אבדן עסקים, עוגמת נפש או נזק מוניטין.</li>
                <li>אחריות החברה לנזק גופני תוכרע לפי פקודת הנזיקין [נוסח חדש], תשס"ח-2008, ואינה מוגבלת בסכום.</li>
                <li>החברה לא תישא באחריות לנזק שנגרם עקב כוח עליון.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">10. ליסינג פרטי ועסקי</h2>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>הסכם ליסינג הינו חוזה מחייב לתקופה שלא תפחת מ-12 חודשים.</li>
                <li>המחירים המוצגים באתר הם אינדיקטיביים בלבד. ההצעה הסופית תינתן בהסכם בכתב חתום על ידי שני הצדדים.</li>
                <li>ביטול הסכם ליסינג לפני תום התקופה ייגרור פיצוי מוסכם כמפורט בחוזה הספציפי, לא פחות מ-3 תשלומים חודשיים.</li>
                <li>החברה שומרת לעצמה את הזכות לסרב לבקשת ליסינג לאחר בחינת יכולת כלכלית.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">11. קניין רוחני</h2>
              <p>כל התוכן באתר — לוגו, עיצוב, טקסטים, תמונות, מאגרי נתונים ותוכנות — הינו קניינה הבלעדי של SmartCar ומוגן בחוק זכות יוצרים, 5768-2007. אין להעתיק, לשכפל, להפיץ או להשתמש בתוכן ללא הסכמה מפורשת בכתב.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">12. כוח עליון</h2>
              <p>החברה לא תהא אחראית לאי-עמידה בהתחייבויות עקב כוח עליון, לרבות מלחמה, פעולות איבה, שביתות, צווי שלטוניים, מגפות, אסונות טבע, קריסת תשתית, או כל אירוע שאינו בשליטת החברה. במקרים אלה, השוכר יהיה זכאי לזיכוי מלא לשימוש עתידי.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">13. שיפוי</h2>
              <p>השוכר מסכים לשפות ולהגן על SmartCar, מנהליה, עובדיה וסוכניה מכל תביעה, נזק, הוצאה (לרבות שכ"ט עורך דין) או אחריות הנובעת מ: הפרת תנאי חוזה זה; שימוש לא חוקי ברכב; נזק שנגרם לצד שלישי בשל מחדל השוכר.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">14. יישוב סכסוכים ושיפוט</h2>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>הצדדים יפעלו תחילה לפתרון כל סכסוך בדרך של משא ומתן ישיר תוך 30 יום.</li>
                <li>לא הושג פתרון — הסכסוך יועבר לבוררות לפי חוק הבוררות, תשכ"ח-1968, בפני בורר מוסכם.</li>
                <li>הדין החל: דיני מדינת ישראל בלבד.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">15. כללי</h2>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li><strong>הפרדה:</strong> אם סעיף כלשהו ייפסל כבלתי אכיף, שאר התנאים יישארו בתוקף.</li>
                <li><strong>ויתור:</strong> אי-אכיפת תנאי כלשהו בשלב מסוים אינה מהווה ויתור על אכיפתו בעתיד.</li>
                <li><strong>שינויים:</strong> החברה רשאית לעדכן תנאים אלה. שינויים מהותיים יפורסמו 14 יום מראש. שימוש לאחר הפרסום = הסכמה.</li>
                <li><strong>שפה:</strong> בכל סתירה בין הגרסה העברית לגרסה האנגלית — הגרסה העברית גוברת.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">16. יצירת קשר</h2>
              <ul className="list-none space-y-1 text-sm">
                <li>📧 <a href="mailto:office@smartcar.co.il" className="text-[#2D5F5F] underline">office@smartcar.co.il</a></li>
                <li>📞 <a href="tel:09-9509757" className="text-[#2D5F5F] underline">09-9509757</a></li>
                <li>📍 רמת ים 122 (מלון דן אכדיה), הרצליה 46851</li>
                <li>שעות פעילות: א&apos;–ה&apos; 08:00–18:00 | ו&apos; 08:00–13:00</li>
              </ul>
            </section>
          </>
        ) : (
          <>
            {/* ─── ENGLISH ────────────────────────────────────────── */}
            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">1. Definitions</h2>
              <ul className="list-none space-y-2 text-sm">
                <li><strong>"SmartCar" / "the Company"</strong> — SmartCar, operating car rental and leasing services in Israel.</li>
                <li><strong>"Renter"</strong> — Any person who has reserved and/or signed a rental agreement with the Company.</li>
                <li><strong>"Additional Driver"</strong> — Any person authorised to drive the rental vehicle in addition to the primary renter.</li>
                <li><strong>"Rental Period"</strong> — From the pickup time stated in the agreement to the return time stated in the agreement.</li>
                <li><strong>"Damage"</strong> — Any physical, mechanical, cosmetic or other impairment to the vehicle, including interior soiling and smoke odour.</li>
                <li><strong>"Force Majeure"</strong> — An unforeseeable event outside the Company's control: war, strike, government order, natural disaster, pandemic.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">2. Rental Eligibility — Mandatory Requirements</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Minimum age:</strong> 21 years. For LUXURY, SUV, VAN categories — 23 years.</li>
                <li><strong>Licence experience:</strong> At least 24 continuous months from licence issue date.</li>
                <li><strong>Valid licence:</strong> Must remain valid throughout the entire rental period.</li>
                <li><strong>Non-Israeli residents:</strong> Must present an International Driving Permit alongside a valid national licence, or a licence from a country recognised by Israel.</li>
                <li><strong>Security deposit:</strong> Valid credit card in the renter's name required. Debit cards are not accepted.</li>
                <li>A renter who fails to meet the above requirements at pickup will forfeit all amounts paid — no refund.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">3. Deposit & Payment</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Deposit will be released within 14 business days of vehicle return, provided no damage is found.</li>
                <li>Rental fees are charged in full before vehicle handover.</li>
                <li>Indicative deposit amounts by category: Economy — ₪1,000 | Compact/Sedan/Electric — ₪1,500 | SUV/Van/Convertible — ₪2,000–₪2,500 | Luxury — ₪3,000. <strong>Final amounts are determined in the written rental agreement and confirmed by a SmartCar agent.</strong></li>
                <li>The Company may deduct from the deposit: damage costs, cleaning fees, missing fuel, fines/penalties incurred during the rental period.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">4. Cancellation, Modification & Refunds</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm mt-2">
                  <thead>
                    <tr className="bg-[#eef6f6]">
                      <th className="border border-gray-200 p-3 text-left">Cancellation Timing</th>
                      <th className="border border-gray-200 p-3 text-left">Cancellation Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td className="border border-gray-200 p-3">More than 72 hours before pickup</td><td className="border border-gray-200 p-3">No charge — full refund</td></tr>
                    <tr><td className="border border-gray-200 p-3">72–48 hours before pickup</td><td className="border border-gray-200 p-3">25% of base rental fee</td></tr>
                    <tr><td className="border border-gray-200 p-3">48–24 hours before pickup</td><td className="border border-gray-200 p-3">50% of base rental fee</td></tr>
                    <tr><td className="border border-gray-200 p-3">Less than 24 hours / No-show</td><td className="border border-gray-200 p-3">100% — no refund</td></tr>
                  </tbody>
                </table>
              </div>
              <ul className="list-disc list-inside space-y-2 ml-4 mt-4 text-sm">
                <li>"Base rental fee" = vehicle cost only, excluding any add-on extras purchased.</li>
                <li>Date changes are permitted up to 48 hours before pickup at no charge, subject to availability.</li>
                <li>Cancellations due to force majeure qualify for a future-use credit, not a cash refund.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">5. Vehicle Availability — If the Vehicle Is Unavailable</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>The Company will make every reasonable effort to supply a vehicle of the same category reserved.</li>
                <li>If the reserved category is unavailable, the renter will be offered a <strong>higher-category vehicle at no extra charge</strong>.</li>
                <li>If no vehicle is available — the renter is entitled to a <strong>full refund</strong> of all amounts paid. No further compensation is owed.</li>
                <li>The Company is not liable for indirect damages (lost income, alternative transport costs) arising from vehicle unavailability.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">6. Vehicle Use — Renter Obligations</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Driving under the influence of alcohol, drugs or impairing medication is strictly prohibited.</li>
                <li>Driving outside Israel requires prior written authorisation. Violation voids all insurance coverage.</li>
                <li>Smoking inside the vehicle is prohibited. Smoke contamination incurs a minimum cleaning charge of ₪500.</li>
                <li>Vehicle is delivered with a full fuel tank and must be returned with a full tank. Missing fuel will be charged at market price.</li>
                <li><strong>Mileage allowance:</strong> The included mileage is determined by rental duration — 1–7 days: 250 km/day; 8–30 days: 220 km/day; over 30 days: 4,000 km per 30-day period. Excess kilometres are charged at the rate stated in the rental agreement.</li>
                <li>Commercial use for ride-hailing (Uber, Bolt, taxi) is prohibited.</li>
                <li>Towing or hauling trailers without prior written authorisation is prohibited.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">7. Damage, Accidents & Theft</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Vehicle inspection:</strong> The renter must inspect the vehicle at pickup and sign the initial condition report. Damage not recorded therein is deemed to have occurred during the rental period.</li>
                <li><strong>Accident:</strong> Must be reported to the Company within one hour and a damage report completed. Failure to report voids insurance coverage.</li>
                <li><strong>Theft:</strong> A police report must be filed within two hours and a copy provided to the Company. Renter liability in case of theft is limited to the deposit amount, provided valid insurance is in force.</li>
                <li><strong>Excess:</strong> The excess amount is defined in the specific rental agreement and according to the insurance package purchased. Purchasing "Damage Waiver" reduces the excess to zero for Type-A damage (excludes wilful damage, DUI, driving outside Israel).</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">8. Fines & Penalties</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>All fines, tickets and penalties incurred during the rental period are the renter's sole responsibility.</li>
                <li>Fines received after vehicle return will be forwarded to the renter by registered mail.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">9. Limitation of Liability</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>The Company's total liability to the renter under any cause of action is limited to the rental fees actually paid for the relevant booking.</li>
                <li>The Company is not liable for indirect, consequential, lost profit, lost business, emotional distress or reputational damages.</li>
                <li>Liability for personal injury is governed by the Israeli Torts Ordinance and is not capped.</li>
                <li>The Company is not liable for damages arising from force majeure.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">10. Dispute Resolution & Jurisdiction</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>The parties will first attempt to resolve any dispute through direct negotiation within 30 days.</li>
                <li>Unresolved disputes will be referred to arbitration under the Israeli Arbitration Law, 5728-1968.</li>
                <li>Governing law: Israeli law exclusively. In any conflict between Hebrew and English versions, the Hebrew version prevails.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">11. General</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Severability:</strong> If any provision is found unenforceable, the remainder of these terms remain in force.</li>
                <li><strong>Waiver:</strong> Failure to enforce any provision on any occasion is not a waiver of future enforcement.</li>
                <li><strong>Amendments:</strong> The Company may update these terms. Material changes will be published 14 days in advance. Continued use after publication constitutes acceptance.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-4">12. Contact</h2>
              <ul className="list-none space-y-1 text-sm">
                <li>📧 <a href="mailto:office@smartcar.co.il" className="text-[#2D5F5F] underline">office@smartcar.co.il</a></li>
                <li>📞 <a href="tel:09-9509757" className="text-[#2D5F5F] underline">09-9509757</a></li>
                <li>📍 122 Ramat Yam St (Dan Accadia Hotel), Herzliya 46851, Israel</li>
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
