import type { Metadata } from 'next';
import Link from 'next/link';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === 'he' ? 'מידע על ביטוח' : 'Insurance Information',
    description:
      locale === 'he'
        ? 'כל מה שצריך לדעת על הביטוח הכלול בהשכרת הרכב שלך ב-SmartCar'
        : 'Everything you need to know about the insurance included with your SmartCar rental',
  };
}

const DEDUCTIBLE_TABLE_HE = [
  { cat: 'כלכלה (Economy)', dep: '₪1,000', ded: '₪3,000' },
  { cat: 'קומפקטי / סדאן', dep: '₪1,500', ded: '₪3,500' },
  { cat: 'חשמלי / היברידי', dep: '₪1,500', ded: '₪3,500' },
  { cat: 'SUV / ואן', dep: '₪2,000', ded: '₪4,500' },
  { cat: 'קבריולט / פרימיום', dep: '₪2,500', ded: '₪5,000' },
  { cat: 'יוקרה (Luxury)', dep: '₪3,000', ded: '₪7,000' },
];

const DEDUCTIBLE_TABLE_EN = [
  { cat: 'Economy', dep: '₪1,000', ded: '₪3,000' },
  { cat: 'Compact / Sedan', dep: '₪1,500', ded: '₪3,500' },
  { cat: 'Electric / Hybrid', dep: '₪1,500', ded: '₪3,500' },
  { cat: 'SUV / Van', dep: '₪2,000', ded: '₪4,500' },
  { cat: 'Convertible / Premium', dep: '₪2,500', ded: '₪5,000' },
  { cat: 'Luxury', dep: '₪3,000', ded: '₪7,000' },
];

export default async function InsurancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const isHe = locale === 'he';

  const deductibleTable = isHe ? DEDUCTIBLE_TABLE_HE : DEDUCTIBLE_TABLE_EN;

  return (
    <div
      className={`max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 ${isHe ? 'text-right' : 'text-left'}`}
      dir={isHe ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="mb-10">
        <p className="text-[#E8743B] text-sm font-semibold uppercase tracking-widest mb-2">SmartCar</p>
        <h1 className="text-4xl font-black text-[#0D2B2B] mb-3">
          {isHe ? 'מידע על ביטוח' : 'Insurance Information'}
        </h1>
        <p className="text-gray-500 text-base leading-relaxed max-w-2xl">
          {isHe
            ? 'כל ביטוח רכב השכרה שלנו כולל כיסוי בסיסי מלא. הדף הזה מסביר בדיוק מה מכוסה, מה ההשתתפות העצמית שלך, ומה אפשר להוסיף.'
            : 'Every SmartCar rental includes full basic coverage. This page explains exactly what is covered, what your deductible is, and what optional extras are available.'}
        </p>
      </div>

      {/* Quick-nav pills */}
      <div className={`flex flex-wrap gap-2 mb-12 ${isHe ? 'justify-end' : 'justify-start'}`}>
        {(isHe
          ? ['כיסוי בסיסי', 'השתתפות עצמית', 'CDW', 'אחריות צד שלישי', 'מה לא מכוסה', 'מסמכים נדרשים']
          : ['Basic Coverage', 'Deductible', 'CDW Waiver', 'Third-Party Liability', 'Not Covered', 'Required Documents']
        ).map((label, i) => (
          <a
            key={i}
            href={`#section-${i + 1}`}
            className="text-xs px-3 py-1.5 rounded-full bg-[#eef6f6] text-[#2D5F5F] font-semibold hover:bg-[#2D5F5F] hover:text-white transition-colors"
          >
            {label}
          </a>
        ))}
      </div>

      <div className="space-y-12 text-gray-700 leading-relaxed">

        {/* ─── 1. BASIC COVERAGE ─────────────────────────────────── */}
        <section id="section-1">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-3xl">🛡️</span>
            <h2 className="text-2xl font-bold text-[#0D2B2B]">
              {isHe ? '1. כיסוי ביטוחי בסיסי — כלול בכל השכרה' : '1. Basic Insurance Coverage — Included in Every Rental'}
            </h2>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-4">
            <p className="font-semibold text-green-800 mb-3">
              {isHe ? 'הכיסוי הבא כלול אוטומטית — ללא תוספת תשלום:' : 'The following coverage is automatically included — at no extra charge:'}
            </p>
            <ul className="space-y-2 text-green-900 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold shrink-0">✓</span>
                {isHe
                  ? 'ביטוח חובה (צד שלישי) מלא לפי חוק ביטוח רכב מנועי, תשל"ה-1975 — כיסוי ללא הגבלת סכום לנזקי גוף לצד שלישי'
                  : 'Mandatory third-party liability insurance under the Israeli Motor Vehicle Insurance Law, 1975 — unlimited personal injury coverage for third parties'}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold shrink-0">✓</span>
                {isHe
                  ? 'ביטוח מקיף בסיסי — מכסה נזק לרכב מתאונה, שריפה וגניבה כפופים להשתתפות עצמית'
                  : 'Basic comprehensive insurance — covers vehicle damage from accidents, fire, and theft, subject to the deductible'}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold shrink-0">✓</span>
                {isHe
                  ? 'כיסוי צד שלישי לנזק רכוש — עד תקרה הקבועה בפוליסה'
                  : 'Third-party property damage coverage — up to the limit defined in the policy'}
              </li>
            </ul>
          </div>
          <p className="text-sm text-gray-500">
            {isHe
              ? 'הביטוח חל על הנהג הראשי ועל כל נהג נוסף שאושר ונרשם בחוזה השכירות. נהג שאינו רשום בחוזה — אינו מכוסה.'
              : 'Coverage applies to the primary driver and any additional driver approved and listed in the rental agreement. An unlisted driver is not covered.'}
          </p>
        </section>

        {/* ─── 2. DEDUCTIBLE ─────────────────────────────────────── */}
        <section id="section-2">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-3xl">💳</span>
            <h2 className="text-2xl font-bold text-[#0D2B2B]">
              {isHe ? '2. השתתפות עצמית (Deductible)' : '2. Deductible (השתתפות עצמית)'}
            </h2>
          </div>
          <p className="mb-4">
            {isHe
              ? 'בכל מקרה של נזק לרכב, גניבה או תאונה — גובה ההשתתפות העצמית הוא הסכום שאתה אחראי לשלם, אפילו אם הביטוח הבסיסי מכסה את שאר הנזק. הפיקדון שנחסם על כרטיס האשראי שלך נועד לכיסוי ההשתתפות העצמית במקרה הצורך.'
              : 'In any case of vehicle damage, theft or accident — the deductible is the amount you are responsible to pay, even when the basic insurance covers the remainder of the damage. The deposit held on your credit card is intended to cover the deductible if needed.'}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#eef6f6]">
                  <th className={`p-4 font-semibold text-[#0D2B2B] ${isHe ? 'text-right' : 'text-left'}`}>
                    {isHe ? 'קטגוריית רכב' : 'Vehicle Category'}
                  </th>
                  <th className={`p-4 font-semibold text-[#0D2B2B] ${isHe ? 'text-right' : 'text-left'}`}>
                    {isHe ? 'פיקדון (אינדיקטיבי)' : 'Deposit (indicative)'}
                  </th>
                  <th className={`p-4 font-semibold text-[#0D2B2B] ${isHe ? 'text-right' : 'text-left'}`}>
                    {isHe ? 'השתתפות עצמית סטנדרטית' : 'Standard Deductible'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {deductibleTable.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    <td className="p-4 border-t border-gray-100">{row.cat}</td>
                    <td className="p-4 border-t border-gray-100 font-medium text-gray-800">{row.dep}</td>
                    <td className="p-4 border-t border-gray-100 font-bold text-[#0D2B2B]">{row.ded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            {isHe
              ? 'הסכומים המוצגים הם אינדיקטיביים. הסכום הסופי יאושר בחוזה ההשכרה הספציפי.'
              : 'Amounts shown are indicative. The final amount is confirmed in the specific rental agreement.'}
          </p>
        </section>

        {/* ─── 3. CDW ────────────────────────────────────────────── */}
        <section id="section-3">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-3xl">⭐</span>
            <h2 className="text-2xl font-bold text-[#0D2B2B]">
              {isHe ? '3. ביטול השתתפות עצמית (CDW) — תוספת אופציונלית' : '3. Collision Damage Waiver (CDW) — Optional Add-on'}
            </h2>
          </div>
          <div className="bg-[#eef6f6] border border-[#B8D8D8] rounded-2xl p-6 mb-4">
            <div className={`flex items-center justify-between mb-4 flex-wrap gap-3 ${isHe ? 'flex-row-reverse' : ''}`}>
              <div>
                <span className="inline-block bg-[#E8743B] text-white text-xs font-bold px-3 py-1 rounded-full mb-2">
                  {isHe ? 'מומלץ' : 'Recommended'}
                </span>
                <p className="font-bold text-[#0D2B2B] text-lg">
                  {isHe ? 'ביטול השתתפות עצמית (CDW / Damage Waiver)' : 'Collision Damage Waiver (CDW)'}
                </p>
              </div>
              <div className={isHe ? 'text-right' : 'text-left'}>
                <p className="text-3xl font-black text-[#E8743B]">₪45</p>
                <p className="text-sm text-gray-500">{isHe ? 'לכל יום שכירות' : 'per rental day'}</p>
              </div>
            </div>
            <p className="text-[#2D5F5F] font-semibold mb-3">
              {isHe ? 'מה כלול:' : 'What is included:'}
            </p>
            <ul className="space-y-1.5 text-sm text-gray-700">
              {(isHe ? [
                'מפחית את ההשתתפות העצמית שלך לאפס (₪0) בנזקי Type A',
                'נזק מתאונה בדרך (פגיעה בעמוד, חניה, תאונת דרכים)',
                'שריפה לא מכוונת',
                'נזק כתוצאה מסחף של עצם חיצוני (ענף, אבן)',
                'גניבה חלקית או מלאה של הרכב (בכפוף לדוח משטרה)*',
                'שקט נפשי מלא לכל תקופת ההשכרה',
              ] : [
                'Reduces your deductible to zero (₪0) for Type A damage',
                'Accident damage on the road (collision with a post, parking damage, traffic accidents)',
                'Unintentional fire damage',
                'Damage from external objects (branches, stones)',
                'Partial or full vehicle theft (subject to police report)*',
                'Full peace of mind throughout the rental period',
              ]).map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[#E8743B] font-bold shrink-0">✓</span>
                  {item}
                </li>
              ))}
              <li className="text-xs text-gray-400 mt-2 pe-1">
                {isHe
                  ? '* כיסוי גניבה תלוי בתנאי הפוליסה ואינו מובטח בכל מצב — פרטים מלאים בחוזה השכירות.'
                  : '* Theft coverage is subject to policy conditions and is not guaranteed in all circumstances — full details in the rental agreement.'}</li>
            </ul>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="font-semibold text-amber-800 mb-2">
              {isHe ? '⚠️ גם עם CDW — הפעולות הבאות אינן מכוסות:' : '⚠️ Even with CDW — the following are NOT covered:'}
            </p>
            <ul className="text-sm text-amber-900 space-y-1">
              {(isHe ? [
                'נזק מכוון או רשלנות ברורה',
                'נהיגה תחת השפעת אלכוהול/סמים (DUI)',
                'נסיעה מחוץ לגבולות ישראל ללא אישור',
                'נזק לצמיגים, גלגלים, מראות חיצוניות, תקרה ותחתית (ללא שדרוג מיוחד)',
                'נהג שאינו רשום בחוזה השכירות',
              ] : [
                'Intentional damage or gross negligence',
                'Driving under the influence of alcohol or drugs (DUI)',
                'Driving outside Israel without prior written authorisation',
                'Damage to tyres, wheels, external mirrors, roof and underbody (without special upgrade)',
                'A driver not listed in the rental agreement',
              ]).map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-red-500 font-bold shrink-0">✗</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ─── 4. THIRD-PARTY LIABILITY ──────────────────────────── */}
        <section id="section-4">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-3xl">👥</span>
            <h2 className="text-2xl font-bold text-[#0D2B2B]">
              {isHe ? '4. אחריות לצד שלישי (ביטוח חובה)' : '4. Third-Party Liability (Compulsory Insurance)'}
            </h2>
          </div>
          <p className="mb-4">
            {isHe
              ? 'ביטוח החובה הישראלי מוסדר בחוק ביטוח רכב מנועי (נפגעי תאונות דרכים), תשל"ה-1975. כל רכב מושכר כולל כיסוי מלא:'
              : 'Compulsory Israeli insurance is governed by the Motor Vehicle Insurance Law (Road Accident Victims), 5735-1975. Every rental vehicle includes full coverage:'}
          </p>
          <ul className="space-y-3">
            {(isHe ? [
              { icon: '✓', text: 'פיצוי ללא הגבלת סכום לנפגעי גוף בתאונות דרכים — כולל נהגים, נוסעים, הולכי רגל' },
              { icon: '✓', text: 'פיצוי עבור הוצאות רפואיות, אובדן השתכרות, וכאב וסבל כחוק' },
              { icon: '✓', text: 'אחריות לנזק רכוש של צד שלישי עד תקרה שנקבעת בפוליסה' },
              { icon: '✓', text: 'הכיסוי חל בכל רחבי ישראל — כולל כבישים עירוניים, בינעירוניים ושטחי תעשייה' },
            ] : [
              { icon: '✓', text: 'Unlimited personal injury compensation for road accident victims — drivers, passengers, pedestrians' },
              { icon: '✓', text: 'Compensation for medical expenses, lost earnings, and pain & suffering per statute' },
              { icon: '✓', text: 'Third-party property damage liability up to the limit defined in the policy' },
              { icon: '✓', text: 'Coverage applies throughout Israel — including urban roads, highways, and industrial areas' },
            ]).map((item, i) => (
              <li key={i} className="flex items-start gap-3 bg-gray-50 rounded-xl p-4">
                <span className="text-green-600 font-bold text-lg shrink-0">{item.icon}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── 5. NOT COVERED ────────────────────────────────────── */}
        <section id="section-5">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-3xl">🚫</span>
            <h2 className="text-2xl font-bold text-[#0D2B2B]">
              {isHe ? '5. מה אינו מכוסה — בכל המקרים' : '5. What Is Not Covered — In All Cases'}
            </h2>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <p className="font-semibold text-red-800 mb-4">
              {isHe
                ? 'בכל אחד מהמקרים הבאים — כיסוי הביטוח בטל, וכל האחריות הכספית חלה על השוכר:'
                : 'In any of the following cases — insurance coverage is void and full financial liability falls on the renter:'}
            </p>
            <ul className="space-y-2 text-sm">
              {(isHe ? [
                { label: 'נהיגה תחת השפעת אלכוהול/סמים (DUI)', detail: 'ייגרר גם הליך משפטי נפרד' },
                { label: 'נסיעה מחוץ לישראל ללא אישור כתוב מראש', detail: 'ירדן, מצרים — דורשים פוליסה נפרדת' },
                { label: 'נהג לא מורשה (שאינו רשום בחוזה)', detail: 'כולל בן זוג או קרוב משפחה שאינם בחוזה' },
                { label: 'שימוש מסחרי ברכב (מונית, Uber, Bolt)', detail: 'הפרת תנאי השכירות' },
                { label: 'נסיעה בשטח לא סלול (off-road)', detail: 'ללא קשר לסוג הרכב' },
                { label: 'גרירת נגרר ללא אישור מפורש', detail: '' },
                { label: 'נזק שנגרם בעת חניה לא חוקית', detail: 'כגון סלע, מדרכה' },
                { label: 'השארת מפתחות ברכב ונגנב הרכב', detail: 'רשלנות ברורה' },
                { label: 'נזק פנים מריח עישון', detail: 'מינימום ₪500 ניקוי' },
              ] : [
                { label: 'Driving under the influence of alcohol or drugs (DUI)', detail: 'Also subject to separate criminal proceedings' },
                { label: 'Driving outside Israel without prior written authorisation', detail: 'Jordan, Egypt — require separate policy' },
                { label: 'Unlisted/unauthorised driver (not named in the agreement)', detail: 'Including spouse or family member if not listed' },
                { label: 'Commercial use (taxi, Uber, Bolt)', detail: 'Breach of rental terms' },
                { label: 'Off-road or unsurfaced terrain driving', detail: 'Regardless of vehicle type' },
                { label: 'Towing a trailer without explicit written authorisation', detail: '' },
                { label: 'Damage caused while parked illegally', detail: 'e.g., on a kerb, rock' },
                { label: 'Keys left in the vehicle when stolen', detail: 'Gross negligence' },
                { label: 'Interior smoke damage', detail: 'Minimum ₪500 cleaning fee' },
              ]).map((item, i) => (
                <li key={i} className={`flex items-start gap-3 py-2 ${i < (isHe ? 8 : 8) ? 'border-b border-red-100' : ''}`}>
                  <span className="text-red-500 font-bold shrink-0 mt-0.5">✗</span>
                  <div>
                    <span className="font-medium text-red-900">{item.label}</span>
                    {item.detail && <span className="text-red-600 text-xs me-2"> — {item.detail}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ─── 6. REQUIRED DOCUMENTS ─────────────────────────────── */}
        <section id="section-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-3xl">📋</span>
            <h2 className="text-2xl font-bold text-[#0D2B2B]">
              {isHe ? '6. מסמכים נדרשים ביום האיסוף' : '6. Required Documents at Pickup'}
            </h2>
          </div>
          <p className="mb-5 text-sm">
            {isHe
              ? 'כל הדוקומנטים חייבים להיות מקוריים — צילומים, כולל מצלמת הטלפון, אינם מתקבלים.'
              : 'All documents must be originals — photocopies, including phone photos, are not accepted.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(isHe ? [
              { icon: '🪪', title: 'תעודת זהות / דרכון', detail: 'ישראלי: ת"ז. תייר: דרכון תקף.' },
              { icon: '🚗', title: 'רישיון נהיגה מקורי בתוקף', detail: 'חייב להיות תקף לכל תקופת ההשכרה. ותק 24 חודשים לפחות.' },
              { icon: '💳', title: 'כרטיס אשראי על שמך', detail: 'לחיוב הפיקדון. כרטיסי דביט אינם מתקבלים. ויזה, מאסטרקארד מתקבלים.' },
              { icon: '🌍', title: 'רישיון נהיגה בינלאומי (תייר בלבד)', detail: 'נדרש בנוסף לרישיון הלאומי לנהגים מחו"ל. ניתן להפיק בארץ המוצא.' },
            ] : [
              { icon: '🪪', title: 'ID / Passport', detail: 'Israeli residents: ID card. Tourists: valid passport.' },
              { icon: '🚗', title: 'Original valid driving licence', detail: 'Must remain valid throughout the rental. Minimum 24 months of experience required.' },
              { icon: '💳', title: 'Credit card in your name', detail: 'Required for the deposit hold. Debit cards are not accepted. Visa and Mastercard are accepted.' },
              { icon: '🌍', title: 'International Driving Permit (tourists only)', detail: 'Required in addition to your national licence for non-Israeli licence holders. Obtainable from your home country.' },
            ]).map((item, i) => (
              <div key={i} className="flex items-start gap-4 bg-[#eef6f6] rounded-2xl p-5">
                <span className="text-3xl shrink-0">{item.icon}</span>
                <div>
                  <p className="font-bold text-[#0D2B2B] mb-1">{item.title}</p>
                  <p className="text-sm text-gray-600">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── CTA ──────────────────────────────────────────────── */}
        <div className="bg-[#0D2B2B] text-white rounded-2xl p-8">
          <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 ${isHe ? 'sm:flex-row-reverse' : ''}`}>
            <div>
              <h3 className="text-xl font-bold mb-1">
                {isHe ? 'עדיין יש שאלות על הביטוח?' : 'Still have questions about insurance?'}
              </h3>
              <p className="text-[#B8D8D8] text-sm">
                {isHe
                  ? 'הנציגים שלנו ישמחו להסביר כל פרט לפני האיסוף.'
                  : 'Our agents will be happy to explain every detail before pickup.'}
              </p>
            </div>
            <div className={`flex gap-3 shrink-0 flex-wrap ${isHe ? 'flex-row-reverse' : ''}`}>
              <a
                href="tel:09-9509757"
                className="bg-[#E8743B] hover:bg-[#d4632a] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors whitespace-nowrap"
              >
                {isHe ? '📞 התקשר עכשיו' : '📞 Call Us Now'}
              </a>
              <Link
                href={`/${locale}/rental`}
                className="border border-white/40 hover:border-white text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors whitespace-nowrap"
              >
                {isHe ? 'הזמן רכב' : 'Book a Car'}
              </Link>
            </div>
          </div>
        </div>

        {/* Contact */}
        <section>
          <ul className="list-none space-y-1 text-sm text-gray-600">
            <li>📧 <a href="mailto:office@smartcar.co.il" className="text-[#2D5F5F] underline">office@smartcar.co.il</a></li>
            <li>📞 <a href="tel:09-9509757" className="text-[#2D5F5F] underline">09-9509757</a></li>
            <li>📍 {isHe ? 'רמת ים 122 (מלון דן אכדיה), הרצליה 46851' : '122 Ramat Yam St (Dan Accadia Hotel), Herzliya 46851, Israel'}</li>
          </ul>
        </section>

      </div>
    </div>
  );
}
