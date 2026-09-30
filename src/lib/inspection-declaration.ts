/**
 * Declaration the customer signs on the inspection page and in the signed
 * PDF, for pickup and for return, in Hebrew and English. Wording approved
 * by the business owner (Ido). Amounts and detailed terms are left to the
 * rental agreement so the two never conflict.
 */

const LATE_CHARGES_HE = `חיובים שמגיעים מאוחר
חלק מהחיובים מגיעים אלינו רק שבועות אחרי סיום השכירות. אני אחראי/ת לכל חיוב שנוצר מהרגע שקיבלתי את הרכב ועד שהחזרתי אותו, גם אם ההודעה עליו תגיע מאוחר יותר, ובהם:
• כביש 6, מנהרות הכרמל, הנתיב המהיר וכבישי אגרה נוספים
• דוחות חניה ודוחות של רשויות מקומיות
• דוחות תנועה ומשטרה, כולל מצלמות מהירות ורמזור
• גרירה, פינוי, נעילת גלגל או אחסנת רכב
אני מסכים/ה שחברת SmartCar תסב דוחות על שמי ככל שהחוק מאפשר, ותחייב את אמצעי התשלום שמסרתי בסכום החיוב ובדמי טיפול לפי הסכם השכירות. על כל חיוב כזה אקבל הודעה עם פירוט.`;

const LATE_CHARGES_EN = `Charges that arrive later
Some charges only reach us weeks after a rental ends. I am responsible for every charge incurred from the moment I received the vehicle until I returned it, even if the notice arrives later, including:
• Road 6, the Carmel Tunnels, the Fast Lane and other toll roads
• Parking tickets and local-authority fines
• Traffic and police fines, including speed and red-light cameras
• Towing, removal, wheel clamping or vehicle storage
I agree that SmartCar may transfer fines to my name as far as the law allows, and charge the payment method I provided for the amount plus a handling fee under the rental agreement. I will receive a notice with details of any such charge.`;

export const INSPECTION_DECLARATION: Record<'pickup' | 'return', { he: string; en: string }> = {
  pickup: {
    he: `אישור קבלת רכב

לפני היציאה לדרך עברנו יחד על מצב הרכב. בחתימתי על המסמך אני מאשר/ת:

מצב הרכב
ראיתי את הרכב ואת תיעוד הבדיקה (סרטון, שרטוט נזקים, תמונות וצ'קליסט, לפי מה שצורף), והם משקפים נכון את מצבו ברגע המסירה. הנזקים שסומנו הם הנזקים הקיימים ברכב. נזק שלא סומן ויתגלה בהחזרה ייחשב כנזק שנוצר בתקופת השכירות, בהתאם להסכם השכירות.

קילומטראז' ודלק
הקילומטראז' ומפלס הדלק שנרשמו נכונים. אחזיר את הרכב עם אותה כמות דלק. אם יחסר דלק, ההשלמה תחויב לפי הסכם השכירות.

שימוש ברכב
אשתמש ברכב בזהירות ולפי החוק, ורק נהגים הרשומים בהסכם ינהגו בו.

${LATE_CHARGES_HE}

אישור זה הוא חלק מהסכם השכירות.
נסיעה טובה!`,
    en: `Vehicle pickup confirmation

Before heading out, we went over the vehicle's condition together. By signing, I confirm:

Condition of the vehicle
I have seen the vehicle and the inspection record (video, damage diagram, photos and checklist, as attached), and they accurately reflect its condition at handover. The damage marked is the existing damage on the vehicle. Any damage not marked that is found at return will be treated as having occurred during the rental, in accordance with the rental agreement.

Mileage and fuel
The recorded odometer reading and fuel level are correct. I will return the vehicle with the same amount of fuel. Any shortfall will be charged under the rental agreement.

Use of the vehicle
I will drive carefully and lawfully, and only drivers listed in the agreement will drive the vehicle.

${LATE_CHARGES_EN}

This confirmation forms part of the rental agreement.
Have a good trip!`,
  },
  return: {
    he: `אישור החזרת רכב

עברנו יחד על מצב הרכב בהחזרה. בחתימתי על המסמך אני מאשר/ת:

מצב הרכב
ראיתי את תיעוד בדיקת ההחזרה (סרטון, שרטוט נזקים, תמונות וצ'קליסט, לפי מה שצורף), והוא משקף נכון את מצב הרכב ברגע ההחזרה. נזק שתועד כאן ולא הופיע בבדיקת הקבלה נוצר בתקופת השכירות ובאחריותי, בהתאם להסכם השכירות.

קילומטראז' ודלק
הקילומטראז' ומפלס הדלק שנרשמו בהחזרה נכונים. חריגה ממכסת הקילומטרים או חוסר בדלק לעומת הקבלה יחויבו לפי הסכם השכירות.

בדיקה סופית
יש נזקים שלא ניתן לזהות בבדיקה מהירה בעת ההחזרה. אם נזק כזה יתגלה בבדיקה מקצועית סמוך לאחר מכן, אקבל הודעה עם פירוט ותמונות לפני כל חיוב.

חפצים אישיים
וידאתי שלקחתי את כל החפצים שלי מהרכב. SmartCar אינה אחראית לחפצים שנשארו ברכב.

${LATE_CHARGES_HE}

אישור זה הוא חלק מהסכם השכירות.
תודה שבחרת בנו!`,
    en: `Vehicle return confirmation

We went over the vehicle's condition together at return. By signing, I confirm:

Condition of the vehicle
I have seen the return inspection record (video, damage diagram, photos and checklist, as attached), and it accurately reflects the vehicle's condition at return. Any damage documented here that did not appear in the pickup inspection occurred during the rental and is my responsibility, in accordance with the rental agreement.

Mileage and fuel
The odometer reading and fuel level recorded at return are correct. Exceeding the mileage allowance or a fuel shortfall compared with pickup will be charged under the rental agreement.

Final inspection
Some damage cannot be spotted in a quick check at return. If such damage is found in a professional inspection shortly afterwards, I will receive a notice with details and photos before any charge.

Personal belongings
I have made sure to take all my belongings from the vehicle. SmartCar is not responsible for items left in the vehicle.

${LATE_CHARGES_EN}

This confirmation forms part of the rental agreement.
Thank you for choosing SmartCar!`,
  },
};

/** Section titles inside the declarations — rendered bold on the sign page and in the PDF. */
export const DECLARATION_HEADINGS = new Set<string>([
  'אישור קבלת רכב',
  'אישור החזרת רכב',
  'מצב הרכב',
  "קילומטראז' ודלק",
  'שימוש ברכב',
  'בדיקה סופית',
  'חפצים אישיים',
  'חיובים שמגיעים מאוחר',
  'Vehicle pickup confirmation',
  'Vehicle return confirmation',
  'Condition of the vehicle',
  'Mileage and fuel',
  'Use of the vehicle',
  'Final inspection',
  'Personal belongings',
  'Charges that arrive later',
]);
