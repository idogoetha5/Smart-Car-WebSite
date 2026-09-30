/**
 * Declaration the customer signs on the inspection page and in the signed
 * PDF, for pickup and for return, in Hebrew and English. Wording approved
 * by the business owner (Ido). Refers to the rental agreement for amounts
 * and terms rather than stating them here, so the two never conflict.
 */

const SHARED_CHARGES_HE = `חיובים מאוחרים
אני מאשר/ת כי אני אחראי/ת לכל התשלומים, הקנסות והחיובים שנוצרו בתקופת השכירות ועד להחזרת הרכב בפועל, גם אם הודעת החיוב מגיעה לחברה לאחר סיום השכירות, ובכלל זה:
• נסיעה בכבישי אגרה — כביש 6, מנהרות הכרמל, הנתיב המהיר וכל כביש אגרה אחר;
• דוחות חניה ודוחות של רשויות מקומיות;
• דוחות תנועה ודוחות משטרה, לרבות מצלמות מהירות ורמזור;
• גרירה, אחסנה, פינוי או נעילת רכב, וכל חיוב אחר שנובע מהשימוש ברכב.
אני מסכים/ה שהחברה תסב על שמי כל דוח או הודעת תשלום כמתאפשר בחוק, ותחייב את אמצעי התשלום שמסרתי בסכום החיוב ובדמי טיפול בהתאם להסכם השכירות. הודעה על כל חיוב כזה תישלח אליי.`;

const SHARED_CHARGES_EN = `Later charges
I confirm that I am responsible for all payments, fines and charges incurred during the rental period and until the vehicle is actually returned, even if the notice reaches the company after the rental ends, including:
• Toll roads — Road 6, the Carmel Tunnels, the Fast Lane and any other toll road;
• Parking tickets and local-authority fines;
• Traffic and police fines, including speed and red-light cameras;
• Towing, storage, clamping or impound, and any other charge arising from use of the vehicle.
I agree that the company may transfer any such fine or payment notice to my name as permitted by law, and charge the payment method I provided for the amount plus a handling fee in accordance with the rental agreement. I will be notified of any such charge.`;

export const INSPECTION_DECLARATION: Record<'pickup' | 'return', { he: string; en: string }> = {
  pickup: {
    he: `הצהרת לקוח — קבלת רכב

1. בדקתי את הרכב לפני קבלתו, עברתי על תיעוד הבדיקה (סרטון, שרטוט נזקים, תמונות וצ'קליסט, ככל שצורפו) ואני מאשר/ת שהוא משקף נכונה את מצב הרכב במועד המסירה.
2. הנזקים הקיימים ברכב הם אלה שסומנו ותועדו בבדיקה זו בלבד. ידוע לי שכל נזק, חוסר או פגם שלא תועד כאן ויימצא ברכב בעת החזרתו, ייחשב כנזק שנגרם בתקופת השכירות ובאחריותי, בהתאם להסכם השכירות.
3. אני מאשר/ת את קריאת הקילומטראז' ואת מפלס הדלק שנרשמו. הרכב יוחזר עם אותו מפלס דלק, אחרת אחויב בהשלמתו בהתאם להסכם השכירות.
4. אני מתחייב/ת להשתמש ברכב בזהירות ובהתאם לחוק ולהסכם השכירות, ולא למסור את הרכב לנהג שאינו רשום בהסכם.

5. ${SHARED_CHARGES_HE}

6. חתימתי על מסמך זה מהווה חלק בלתי נפרד מהסכם השכירות.`,
    en: `Customer declaration — vehicle pickup

1. I inspected the vehicle before receiving it, reviewed the inspection record (video, damage diagram, photos and checklist, as attached) and confirm that it accurately reflects the vehicle's condition at handover.
2. The existing damage on the vehicle is only what was marked and documented in this inspection. I understand that any damage, missing item or defect not documented here and found at return will be treated as having occurred during the rental period and as my responsibility, in accordance with the rental agreement.
3. I confirm the recorded odometer reading and fuel level. The vehicle will be returned with the same fuel level, otherwise I will be charged for refuelling in accordance with the rental agreement.
4. I undertake to use the vehicle with care, in accordance with the law and the rental agreement, and not to let any driver not listed in the agreement drive it.

5. ${SHARED_CHARGES_EN}

6. My signature on this document forms an integral part of the rental agreement.`,
  },
  return: {
    he: `הצהרת לקוח — החזרת רכב

1. נכחתי בבדיקת הרכב בעת החזרתו, עברתי על תיעוד הבדיקה (סרטון, שרטוט נזקים, תמונות וצ'קליסט, ככל שצורפו) ואני מאשר/ת שהוא משקף נכונה את מצב הרכב במועד ההחזרה.
2. ידוע לי שכל נזק, חוסר או פגם שתועד בבדיקה זו ולא הופיע בבדיקת קבלת הרכב, נגרם בתקופת השכירות ובאחריותי, בהתאם להסכם השכירות.
3. אני מאשר/ת את קריאת הקילומטראז' ואת מפלס הדלק שנרשמו בעת ההחזרה. ידוע לי שחריגה ממכסת הקילומטרים ומחסור בדלק לעומת מועד הקבלה יחויבו בהתאם להסכם השכירות.
4. אישור החזרת הרכב אינו מהווה ויתור של החברה על חיוב בגין נזק שלא ניתן היה לזהות בבדיקה במועד ההחזרה, ויתגלה בבדיקה מקצועית סמוך לאחר מכן. על כל חיוב כזה תישלח אליי הודעה בצירוף פירוט.
5. אני אחראי/ת לאסוף את כל חפציי מהרכב. החברה אינה אחראית לחפצים שיישארו ברכב לאחר החזרתו.

6. ${SHARED_CHARGES_HE}

7. חתימתי על מסמך זה מהווה חלק בלתי נפרד מהסכם השכירות.`,
    en: `Customer declaration — vehicle return

1. I was present at the inspection of the vehicle on return, reviewed the inspection record (video, damage diagram, photos and checklist, as attached) and confirm that it accurately reflects the vehicle's condition at return.
2. I understand that any damage, missing item or defect documented in this inspection that did not appear in the pickup inspection occurred during the rental period and is my responsibility, in accordance with the rental agreement.
3. I confirm the odometer reading and fuel level recorded at return. I understand that exceeding the mileage allowance and any fuel shortfall compared with pickup will be charged in accordance with the rental agreement.
4. Confirming the return does not waive the company's right to charge for damage that could not reasonably be identified during the return inspection and is found in a professional inspection shortly afterwards. I will be notified of any such charge with details.
5. I am responsible for collecting all my belongings from the vehicle. The company is not responsible for items left in the vehicle after return.

6. ${SHARED_CHARGES_EN}

7. My signature on this document forms an integral part of the rental agreement.`,
  },
};
