export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isHe = locale === 'he';
  return { title: isHe ? 'הצהרת נגישות' : 'Accessibility Statement' };
}

export default async function AccessibilityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isHe = locale === 'he';

  return (
    <div className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 ${isHe ? 'text-right' : 'text-left'}`} dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mb-8">
        <p className="text-[#E8743B] text-sm font-semibold uppercase tracking-widest mb-2">SmartCar</p>
        <h1 className="text-4xl font-black text-[#0D2B2B] mb-2">
          {isHe ? 'הצהרת נגישות' : 'Accessibility Statement'}
        </h1>
        <p className="text-gray-500 text-sm">
          {isHe ? 'עדכון אחרון: ינואר 2026' : 'Last updated: January 2026'}
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
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">רמת הנגישות שהושגה</h2>
              <ul className="list-disc list-inside space-y-2 mr-4">
                <li>ניווט מלא באמצעות מקלדת</li>
                <li>תמיכה בקוראי מסך (NVDA, JAWS, VoiceOver)</li>
                <li>יחסי ניגוד צבעים עומדים בדרישות AA</li>
                <li>טקסטים חלופיים לתמונות</li>
                <li>תגיות ARIA לרכיבי ממשק דינמיים</li>
                <li>פונטים קריאים בגדלים מותאמים</li>
                <li>תמיכה בהגדלת טקסט עד 200% ללא אובדן תוכן</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">מגבלות ידועות</h2>
              <p>אנו עדיין עובדים על שיפור הנגישות בתחומים הבאים:</p>
              <ul className="list-disc list-inside space-y-2 mr-4 mt-2">
                <li>חלק מהתמונות עשויות להיות ללא תיאור חלופי מפורט</li>
                <li>טפסים מסוימים נמצאים בתהליך שיפור תוויות</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">טכנולוגיות נגישות נתמכות</h2>
              <p>האתר נבדק ופועל כראוי עם: Chrome + NVDA, Safari + VoiceOver, Firefox + JAWS.</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">דיווח על בעיות נגישות</h2>
              <p>נתקלת בבעיית נגישות? נשמח לשמוע ולתקן. ניתן לפנות לרכז הנגישות שלנו:</p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">פרטי רכז הנגישות</h2>
              <ul className="list-none space-y-2">
                <li><strong>שם:</strong> מחלקת שירות לקוחות SmartCar</li>
                <li>📧 <a href="mailto:office@smartcar.co.il" className="text-[#2D5F5F] underline">office@smartcar.co.il</a></li>
                <li>📞 <a href="tel:09-9509757" className="text-[#2D5F5F] underline">09-9509757</a></li>
                <li>📍 רמת ים 122, הרצליה</li>
              </ul>
            </section>

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
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">Accessibility Features</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Full keyboard navigation</li>
                <li>Screen reader support (NVDA, JAWS, VoiceOver)</li>
                <li>Color contrast meets AA standards</li>
                <li>Alternative text for images</li>
                <li>Text can be enlarged up to 200% without content loss</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">Contact Accessibility Coordinator</h2>
              <p>📧 <a href="mailto:office@smartcar.co.il" className="text-[#2D5F5F] underline">office@smartcar.co.il</a> | 📞 09-9509757</p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
