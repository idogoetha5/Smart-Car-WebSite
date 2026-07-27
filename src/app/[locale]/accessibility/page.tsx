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
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">תהליך מתמשך</h2>
              <p>הנגשת האתר היא תהליך מתמשך, ואנו פועלים באופן שוטף לאיתור ותיקון בעיות נגישות ולשיפור התאמת האתר לתקן ישראלי 5568 ולהנחיות WCAG 2.1 ברמה AA. ייתכן שבחלקים מסוימים באתר טרם הושלמה ההתאמה המלאה.</p>
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
              <h2 className="text-2xl font-bold text-[#0D2B2B] mb-3">Accessibility Measures Implemented</h2>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Keyboard navigation</li>
                <li>Structured markup and ARIA tags for dynamic interface elements, to support common screen readers</li>
                <li>Design that takes AA color contrast requirements into account</li>
                <li>Alternative text for images</li>
                <li>Text can be enlarged up to 200% without content loss</li>
              </ul>
              <p className="mt-3">Accessibility is an ongoing process. We continuously work to identify and fix accessibility issues and improve conformance with Israeli Standard 5568 and WCAG 2.1 AA. Some areas of the site may not yet be fully conformant.</p>
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
