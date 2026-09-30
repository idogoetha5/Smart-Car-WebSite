/**
 * Declaration the customer signs on the inspection page and in the signed
 * PDF, for pickup and for return, in Hebrew and English. Wording approved
 * by the business owner (Ido). Amounts and detailed terms are left to the
 * rental agreement so the two never conflict.
 */

const LATE_CHARGES_HE = `אגרות, קנסות ודוחות
אני אחראי/ת לכל חיוב שנוצר ממועד מסירת הרכב ועד מועד החזרתו, לרבות חיובים שהודעה עליהם תתקבל לאחר תום תקופת השכירות, ובהם:
• כביש 6, מנהרות הכרמל, הנתיב המהיר וכבישי אגרה נוספים
• דוחות חניה ודוחות של רשויות מקומיות
• דוחות תנועה ומשטרה, כולל מצלמות מהירות ורמזור
• גרירה, פינוי, נעילת גלגל או אחסנת רכב
אני מסכים/ה שחברת SmartCar תסב דוחות על שמי ככל שהחוק מאפשר, ותחייב את אמצעי התשלום שמסרתי בסכום החיוב ובדמי טיפול לפי הסכם השכירות. על כל חיוב כזה אקבל הודעה עם פירוט.`;

const LATE_CHARGES_EN = `Tolls, fines and penalties
I am responsible for every charge incurred from the time the vehicle was handed over to me until its return, including charges notified after the rental period has ended, such as:
• Road 6, the Carmel Tunnels, the Fast Lane and other toll roads
• Parking tickets and local-authority fines
• Traffic and police fines, including speed and red-light cameras
• Towing, removal, wheel clamping or vehicle storage
I agree that SmartCar may transfer fines to my name as far as the law allows, and charge the payment method I provided for the amount plus a handling fee under the rental agreement. I will receive a notice with details of any such charge.`;

export const INSPECTION_DECLARATION: Record<'pickup' | 'return', { he: string; en: string }> = {
  pickup: {
    he: `אישור מסירת רכב

בחתימתי על מסמך זה אני מאשר/ת כדלקמן:

מצב הרכב
ראיתי את הרכב ואת תיעוד הבדיקה (סרטון, שרטוט נזקים, תמונות וצ'קליסט, לפי מה שצורף), והם משקפים נכון את מצבו ברגע המסירה. הנזקים שסומנו הם הנזקים הקיימים ברכב. נזק שלא סומן ויתגלה בהחזרה ייחשב כנזק שנוצר בתקופת השכירות, בהתאם להסכם השכירות.

קילומטראז' ודלק
הקילומטראז' ומפלס הדלק שנרשמו נכונים. אחזיר את הרכב עם אותה כמות דלק. אם יחסר דלק, ההשלמה תחויב לפי הסכם השכירות.

שימוש ברכב
אשתמש ברכב בזהירות ולפי החוק, ורק נהגים הרשומים בהסכם ינהגו בו.

${LATE_CHARGES_HE}

אישור זה מהווה חלק בלתי נפרד מהסכם השכירות.`,
    en: `Vehicle handover confirmation

By signing this document, I confirm the following:

Condition of the vehicle
I have seen the vehicle and the inspection record (video, damage diagram, photos and checklist, as attached), and they accurately reflect its condition at handover. The damage marked is the existing damage on the vehicle. Any damage not marked that is found at return will be treated as having occurred during the rental, in accordance with the rental agreement.

Mileage and fuel
The recorded odometer reading and fuel level are correct. I will return the vehicle with the same amount of fuel. Any shortfall will be charged under the rental agreement.

Use of the vehicle
I will drive carefully and lawfully, and only drivers listed in the agreement will drive the vehicle.

${LATE_CHARGES_EN}

This confirmation forms an integral part of the rental agreement.`,
  },
  return: {
    he: `אישור החזרת רכב

אני, החתום/ה מטה, מאשר/ת כי החזרתי לחברת SmartCar את הרכב המפורט בטופס זה, וכי עיינתי בממצאי בדיקת ההחזרה שנערכה בנוכחותי. בחתימתי על מסמך זה אני מצהיר/ה ומאשר/ת כדלקמן:

1. מצב הרכב במועד ההחזרה
ממצאי בדיקת ההחזרה, לרבות שרטוט הנזקים, התמונות והסרטון ככל שצורפו, משקפים נכונה את מצב הרכב במועד ההחזרה. נזקים המסומנים באפור תועדו בבדיקת המסירה ואינם באחריותי. נזקים המסומנים באדום לא תועדו בבדיקת המסירה, ויחולו לגביהם הוראות הסכם השכירות.

2. קילומטראז' ומפלס דלק
נתוני הקילומטראז' ומפלס הדלק שנרשמו במועד ההחזרה נכונים. חוסר בדלק ביחס למפלס שנרשם במסירה, וכן חריגה ממכסת הקילומטרים שנקבעה, יחויבו בהתאם להסכם השכירות.

3. נזקים שאינם ניתנים לזיהוי במועד ההחזרה
ידוע לי כי ייתכנו נזקים שלא ניתן לאתרם בבדיקה חזותית במקום, כגון נזקים בחלקו התחתון של הרכב או תקלות מכניות. נזק כאמור שיאותר בבדיקה מקצועית סמוך למועד ההחזרה ושמקורו בתקופת השכירות, יטופל בהתאם להסכם השכירות. בטרם כל חיוב תימסר לי הודעה בכתב בצירוף פירוט ותיעוד.

4. אגרות, קנסות ודוחות מתקופת השכירות
החזרת הרכב אינה גורעת מאחריותי לכל חיוב שנוצר במהלך תקופת השכירות, אף אם ההודעה עליו תתקבל לאחר מועד ההחזרה, ובכלל זה:
• אגרות כביש 6, מנהרות הכרמל, הנתיב המהיר וכבישי אגרה נוספים;
• דוחות חניה ודוחות של רשויות מקומיות;
• דוחות תנועה, לרבות דוחות משטרה ודוחות של מצלמות אכיפה;
• הוצאות גרירה, פינוי, נעילת גלגל ואחסנת רכב.
אני מסכים/ה כי SmartCar תהא רשאית להסב על שמי דוחות כאמור, ככל שהדין מאפשר זאת, ולחייב את אמצעי התשלום שמסרתי בסכום החיוב ובדמי הטיפול הקבועים בהסכם השכירות. על כל חיוב כאמור תימסר לי הודעה בצירוף פירוט.

5. חפצים אישיים
הוצאתי מהרכב את כל חפציי האישיים. SmartCar לא תישא באחריות לחפצים שנותרו ברכב לאחר מועד ההחזרה.

אישור זה מהווה חלק בלתי נפרד מהסכם השכירות, ואין בו כדי לגרוע מהוראותיו.`,
    en: `Vehicle return confirmation

I, the undersigned, confirm that I have returned to SmartCar the vehicle described in this form, and that I have reviewed the findings of the return inspection carried out in my presence. By signing this document, I declare and confirm as follows:

1. Condition of the vehicle at return
The findings of the return inspection, including the damage diagram, photos and video where attached, accurately reflect the condition of the vehicle at the time of return. Damage marked in grey was recorded at the handover inspection and is not my responsibility. Damage marked in red was not recorded at handover, and the provisions of the rental agreement shall apply to it.

2. Mileage and fuel level
The odometer reading and fuel level recorded at return are correct. Any fuel shortfall relative to the level recorded at handover, and any excess over the agreed mileage allowance, will be charged in accordance with the rental agreement.

3. Damage not identifiable at return
I understand that some damage may not be detectable by a visual inspection on site, such as damage to the underside of the vehicle or mechanical faults. Any such damage found in a professional inspection shortly after the return and originating in the rental period will be handled in accordance with the rental agreement. I will receive written notice with details and documentation before any charge.

4. Tolls, fines and penalties from the rental period
Returning the vehicle does not diminish my responsibility for any charge incurred during the rental period, even if notice of it is received after the return, including:
• Road 6, the Carmel Tunnels, the Fast Lane and other toll roads;
• Parking tickets and local-authority fines;
• Traffic fines, including police and enforcement-camera fines;
• Towing, removal, wheel-clamping and vehicle storage costs.
I agree that SmartCar may transfer such fines to my name as far as the law allows, and charge the payment method I provided for the amount plus the handling fee set out in the rental agreement. I will receive notice with details of any such charge.

5. Personal belongings
I have removed all my personal belongings from the vehicle. SmartCar shall not be liable for items left in the vehicle after the return.

This confirmation forms an integral part of the rental agreement and does not derogate from any of its provisions.`,
  },
};

/** Section titles inside the declarations — rendered bold on the sign page and in the PDF. */
export const DECLARATION_HEADINGS = new Set<string>([
  'אישור מסירת רכב',
  'אישור החזרת רכב',
  'מצב הרכב',
  "קילומטראז' ודלק",
  'שימוש ברכב',
  'בדיקה סופית',
  'חפצים אישיים',
  'אגרות, קנסות ודוחות',
  'מצב הרכב בהחזרה',
  '1. מצב הרכב במועד ההחזרה',
  "2. קילומטראז' ומפלס דלק",
  '3. נזקים שאינם ניתנים לזיהוי במועד ההחזרה',
  '4. אגרות, קנסות ודוחות מתקופת השכירות',
  '5. חפצים אישיים',
  'נזקים שיתגלו בבדיקה מקצועית',
  'דוחות וחיובים מתקופת השכירות',
  'Vehicle handover confirmation',
  'Vehicle return confirmation',
  'Condition of the vehicle',
  'Mileage and fuel',
  'Use of the vehicle',
  'Final inspection',
  'Personal belongings',
  'Tolls, fines and penalties',
  'Condition at return',
  '1. Condition of the vehicle at return',
  '2. Mileage and fuel level',
  '3. Damage not identifiable at return',
  '4. Tolls, fines and penalties from the rental period',
  '5. Personal belongings',
  'Damage found in a professional inspection',
  'Fines and charges from the rental period',
]);
