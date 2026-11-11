import type { BranchId } from '@/lib/branches';

type Copy = { he: string; en: string };
// The catalogue/quote hub and the service explainer are different destinations.
// Keep both public, with distinct search intent rather than hiding either one.
export const LEASING_CATALOG_SEARCH = {
  title: { he: 'ליסינג פרטי ועסקי – רכבים ומחיר חודשי | SmartCar', en: 'Car Leasing in Israel – Private & Business | SmartCar' },
  description: { he: 'ליסינג פרטי או עסקי ב-SmartCar: השוו רכבים ומחיר חודשי, בחרו תקופה וקילומטרים בשנה וקבלו הצעה כתובה. מבחר דגמים בכל הגדלים.', en: 'Private or business car leasing in Israel with SmartCar. Compare cars and monthly prices, choose your term and annual mileage, and get a written quote.' },
};
export type RentalAdvice = {
  title: Copy;
  description: Copy;
  sections: { heading: Copy; text: Copy }[];
};

// Editorial advice, not new contractual terms. No prices, inventory promises,
// invented facilities, parking availability or guaranteed delivery times.
export const BRANCH_RENTAL_ADVICE: Record<BranchId, RentalAdvice> = {
  telaviv: {
    title: { he: 'השכרת רכב בתל אביב – סניף הירקון 112 | SmartCar', en: 'Car Rental in Tel Aviv – HaYarkon 112 Branch | SmartCar' },
    description: { he: 'השכרת רכב בתל אביב בסניף SmartCar ברחוב הירקון 112, ליד הטיילת והמלונות. השכרה יומית, חודשית ולפי שעה, או מסירה עד הבית. טל׳ 03-5233073.', en: 'Rent a car in Tel Aviv at the SmartCar branch on HaYarkon 112, near the beach and hotels. Daily, monthly and hourly rental, or delivery to your door.' },
    sections: [
      { heading: { he: 'רכב לביקור בעיר או ליציאה מתל אביב?', en: 'Staying in Tel Aviv or heading out of the city?' }, text: { he: 'לנסיעות עירוניות כדאי להשוות גם מידות רכב ונוחות חניה, ולא רק מחיר יומי. ליציאה משפחתית מהעיר חשוב לבדוק מקום לנוסעים ולמזוודות. אם אתם אוספים מהירקון 112, ציינו מראש את שעות האיסוף וההחזרה הרצויות כדי שנציג יבדוק מה אפשר לתאם.', en: 'For city driving, compare vehicle size and parking practicality as well as the daily rate. For a family trip beyond Tel Aviv, consider passengers and luggage. When collecting at HaYarkon 112, give your preferred collection and return times so a representative can check the arrangements.' } },
      { heading: { he: 'השכרה ליום, לסוף שבוע או לחודש', en: 'A day, a weekend or a month' }, text: { he: 'לביקור קצר בחרו תאריכים ומקום איסוף; לצורך ממושך כדאי לציין גם נסועה צפויה ולבקש הצעה לתקופה כולה. השכרה חודשית וליסינג הם מסלולים שונים: השוו תקופה, קילומטרים, ביטוח ושירותים לפי ההצעה הכתובה, ולא רק את התשלום החודשי.', en: 'For a short visit, choose dates and a collection point. For a longer stay, include expected mileage and ask for a quote covering the full period. Monthly rental and leasing are different arrangements: compare the term, mileage, cover and services in the written quote, not just the monthly payment.' } },
      { heading: { he: 'איסוף בסניף או מסירה לכתובת בתל אביב', en: 'Branch collection or delivery to a Tel Aviv address' }, text: { he: 'אפשר לבקש איסוף בסניף או לתאם מסירה והחזרה בכתובת אחרת. ציינו כתובת, תאריכים ושעות; נציג יאשר זמינות, עלות ונקודת מפגש. מסירה למלון או החזרה במקום אחר אינן נכללות אוטומטית במחיר המוצג באתר.', en: 'You can request branch collection or arrange delivery and return at another address. Provide the address, dates and times; a representative will confirm availability, cost and the meeting point. Hotel delivery or a different return location is not automatically included in the website estimate.' } },
    ],
  },
  herzliya: {
    title: { he: 'השכרת רכב בהרצליה – סניף רמת ים 122 | SmartCar', en: 'Car Rental in Herzliya – Ramat Yam 122 Branch | SmartCar' },
    description: { he: 'השכרת רכב בהרצליה בסניף הראשי של SmartCar, רמת ים 122 ליד דן אכדיה. רכבים לעבודה, לחופשה ולתקופה ארוכה, עם איסוף מהסניף או מסירה עד הבית.', en: 'Car rental in Herzliya at the SmartCar main branch, Ramat Yam 122 by the Dan Accadia. Cars for work, holidays or longer stays, from the branch or delivered.' },
    sections: [
      { heading: { he: 'רכב להרצליה פיתוח, לחופשה או לנסיעות בשרון', en: 'Business in Herzliya Pituach or a stay on the coast' }, text: { he: 'סניף הרצליה נמצא ברמת ים 122. בבקשה לנסיעת עבודה כדאי לציין את משך השימוש והנסועה הצפויה; לחופשה משפחתית ציינו מספר נוסעים ומזוודות. כך אפשר להשוות קבוצות רכב לפי השימוש בפועל לפני שנציג מאשר את ההשכרה.', en: 'The Herzliya branch is at Ramat Yam 122. For business use, include the rental period and expected mileage; for a family holiday, give passenger and luggage needs. This helps compare vehicle groups for your trip before a representative confirms the rental.' } },
      { heading: { he: 'איסוף בהרצליה והחזרה במקום אחר', en: 'Collect in Herzliya and return elsewhere' }, text: { he: 'אם הטיול מתחיל בהרצליה ומסתיים בעיר אחרת, ציינו את שתי הכתובות ואת השעות המבוקשות. אפשר לבקש מסירה והחזרה בתיאום; השירות והמחיר תלויים במיקום, בשעה ובזמינות, ומאושרים עם הנציג.', en: 'If your trip starts in Herzliya and ends elsewhere, include both locations and preferred times. Delivery and return can be requested by arrangement; the service and price depend on location, timing and availability and are confirmed with the representative.' } },
    ],
  },
  jerusalem: {
    title: { he: 'השכרת רכב בירושלים – סניף מלך דוד 8 | SmartCar', en: 'Car Rental in Jerusalem – King David 8 Branch | SmartCar' },
    description: { he: 'השכרת רכב בירושלים בסניף SmartCar ברחוב המלך דוד 8, ליד ממילא. רכב לעיר או לטיול בארץ, השכרה יומית או חודשית, ואפשרות להחזרה בסניף אחר.', en: 'Rent a car in Jerusalem at the SmartCar branch on King David 8, near Mamilla. A car for the city or a trip around Israel, daily or monthly, with returns elsewhere.' },
    sections: [
      { heading: { he: 'בחירת רכב לביקור בירושלים ולטיול מחוץ לעיר', en: 'Choosing a car for Jerusalem and trips beyond it' }, text: { he: 'הסניף נמצא במלך דוד 8, סמוך לממילא. לנסיעות בתוך העיר כדאי להביא בחשבון את מידות הרכב והחניה ביעד; לנסיעה עם משפחה מחוץ לעיר בדקו גם נפח מטען ונוחות לנוסעים. ציינו בבקשה את מספר הנוסעים והמזוודות כדי לקבל התאמה עניינית.', en: 'The branch is at King David 8, near Mamilla. For city trips, consider vehicle size and parking at your destination; for family travel beyond Jerusalem, also compare luggage space and passenger comfort. Include passenger and luggage needs in your request.' } },
      { heading: { he: 'מתכננים איסוף בירושלים והחזרה בנתב״ג?', en: 'Collecting in Jerusalem and returning at Ben Gurion Airport?' }, text: { he: 'ציינו את שני המיקומים, התאריכים והשעות כבר בפנייה. ניתן לבקש תיאום מסירה או החזרה במיקום אחר, בכפוף לאישור נציג. שירות בנתב״ג כרוך בתוספת של 150 ₪, שאינה כלולה באומדן.', en: 'Include both locations, dates and times in your enquiry. Delivery or return at another location can be requested subject to representative confirmation. Airport service carries a ₪150 surcharge, which is not included in the estimate.' } },
    ],
  },
  airport: {
    title: { he: 'השכרת רכב בנתב״ג – מסירה בשדה התעופה 24/7 | SmartCar', en: 'Ben Gurion Airport Car Rental – 24/7 Delivery | SmartCar' },
    description: { he: 'השכרת רכב בנתב״ג: נציג SmartCar מחכה לכם עם הרכב בנמל התעופה בן גוריון ומקבל אותו בחזרה, בתיאום מראש 24/7. תוספת שירות נתב״ג: 150 ₪.', en: 'Car rental at Ben Gurion Airport: a SmartCar representative meets you with the car and collects it on your return, arranged in advance 24/7. Airport fee: ₪150.' },
    sections: [
      { heading: { he: 'מה צריך לתאם לפני הנחיתה?', en: 'What should you arrange before arrival?' }, text: { he: 'שלחו תאריכים, שעות, מספר נוסעים וכמות מזוודות, וציינו שהאיסוף או ההחזרה בנתב״ג. נציג מאשר את הרכב או קבוצת הרכב, פרטי המסירה ונקודת המפגש. אם חל שינוי בטיסה, צרו קשר לעדכון; אל תסתמכו על שינוי אוטומטי בהזמנה.', en: 'Send dates, times, passenger and luggage needs, and specify airport collection or return. A representative confirms the vehicle or group, delivery arrangements and meeting point. If your flight changes, contact the team; do not assume the booking updates automatically.' } },
      { heading: { he: 'מחיר השירות והחזרה בעיר אחרת', en: 'Airport-service cost and returning in another city' }, text: { he: 'שירות נתב״ג הוא בתוספת של 150 ₪. אפשר לבקש איסוף בשדה והחזרה בסניף אחר או להפך; יש לתאם את שני המיקומים מראש. האומדן באתר אינו מחיר סופי, והמחיר והתנאים מחייבים אישור כתוב לפני ההשכרה.', en: 'Airport service has a ₪150 surcharge. You can request airport collection and return at another branch, or the reverse; arrange both locations in advance. The website estimate is not a final price, and the price and terms require written confirmation before rental.' } },
    ],
  },
};

export const SERVICE_RENTAL_ADVICE: Record<string, RentalAdvice> = {
  business: {
    title: { he: 'השכרת רכב לעסקים ולחברות | SmartCar', en: 'Business Car Rental in Israel | SmartCar' },
    description: { he: 'השכרת רכב לעסקים ב-SmartCar: רכב לעובד חדש, לפרויקט זמני או כמה רכבים לפעילות השוטפת. השכרה יומית, חודשית או ליסינג, עם הצעה מותאמת לעסק.', en: 'Business car rental with SmartCar: a car for a new employee, a temporary project or several cars for daily work. Daily, monthly or leasing, quoted for your business.' },
    sections: [
      { heading: { he: 'רכב לעובד, לפרויקט או לכמה צוותים?', en: 'A vehicle for an employee, a project or several teams?' }, text: { he: 'ציינו כמה רכבים דרושים, מי צפוי לנהוג, היכן מתחילה העבודה ומה משך השימוש המשוער. לעובד שנוסע לפגישות ולצוות שמוביל ציוד יש צרכים שונים. התאימו את קבוצות הרכב למספר הנוסעים, למטען ולנסועה לפני שמשווים את עלות התקופה.', en: 'Specify how many vehicles you need, who will drive, where work starts and the expected period. An employee travelling to meetings and a team carrying equipment have different needs. Match vehicle groups to passengers, cargo and mileage before comparing the cost for the full period.' } },
      { heading: { he: 'השכרה עסקית או ליסינג לעסק?', en: 'Business rental or business leasing?' }, text: { he: 'לצורך זמני או לפרויקט עם מועד סיום משתנה, בקשו להשוות השכרה יומית או חודשית. לצורך ממושך ומוגדר בדקו גם מסלול ליסינג. בהצעה הכתובה חשוב לפרט תקופה, קילומטרים, נהגים מורשים, כיסוי, שירותים ותנאי שינוי; לא כל מסלול כולל אותם מרכיבים.', en: 'For a temporary need or a project with a changing end date, compare daily or monthly rental. For a defined longer-term need, also consider leasing. The written quote should explain the term, mileage, authorised drivers, cover, services and change conditions; inclusions differ between plans.' } },
    ],
  },
  commercial: {
    title: { he: 'השכרת רכב מסחרי וואן להובלה | SmartCar', en: 'Commercial Vehicle & Van Rental in Israel | SmartCar' },
    description: { he: 'השכרת רכב מסחרי ב-SmartCar להובלה, ציוד ועבודה שוטפת. ספרו לנו מה מובילים ולכמה זמן, ונתאים רכב מסחרי מתאים – ליום, לשבוע או לחודש.', en: 'Commercial vehicle and van rental with SmartCar for moving, equipment and everyday work. Tell us what you are carrying and for how long, and we will match a vehicle.' },
    sections: [
      { heading: { he: 'מה מעמיסים וכמה מקום צריך?', en: 'What are you carrying and how much space do you need?' }, text: { he: 'לפני בחירת מסחרית מדדו את הפריטים הגדולים וציינו אורך, רוחב, גובה ומשקל משוער. בדקו עם הנציג את מידות תא המטען, פתח ההעמסה, מספר המושבים וכושר ההעמסה של הרכב שיוצע בפועל. תמונה או שם דגם לבדם אינם אישור שהמטען מתאים לרכב.', en: 'Before choosing a van, measure the largest items and provide their length, width, height and estimated weight. Ask the representative to confirm cargo space, loading opening, seats and payload for the actual vehicle offered. A photo or model name alone does not confirm that your load will fit.' } },
      { heading: { he: 'רישיון, תקופה ומסירה של רכב מסחרי', en: 'Licence, rental period and commercial-vehicle delivery' }, text: { he: 'ציינו מי ינהג, את סוג הרישיון ואת מועדי האיסוף וההחזרה. יש לוודא שהרישיון מתאים לרכב המסוים ולא להניח שכל מסחרית מתאימה לכל רישיון. להשכרה ממושכת בקשו הצעה לתקופה כולה, כולל מכסת קילומטרים, כיסוי ועלויות מסירה והחזרה אם נדרשות.', en: 'Provide the driver and licence category as well as collection and return dates. Confirm that the licence is appropriate for the specific vehicle; do not assume every van can be driven on every licence. For a longer rental, request a full-period quote with mileage, cover and any delivery or return charges.' } },
    ],
  },
  'new-driver': {
    title: { he: 'השכרת רכב לנהג צעיר ולנהג חדש מגיל 21 | SmartCar', en: 'Car Rental for Young & New Drivers from 21 | SmartCar' },
    description: { he: 'השכרת רכב לנהגים צעירים ולנהגים חדשים מגיל 21 ב-SmartCar. בדקו אילו רכבים מתאימים לגיל ולוותק הרישיון שלכם ומה הביטוח כולל, ושלחו בקשה.', en: 'Car rental for young and new drivers from age 21 with SmartCar. See which cars suit your age and licence history, what the cover includes, and send a request.' },
    sections: [
      { heading: { he: 'מה לציין כדי לבדוק התאמה לנהג?', en: 'What details help check driver eligibility?' }, text: { he: 'מסרו את גיל הנהג, מועד הוצאת הרישיון, סוג הרישיון ותאריכי ההשכרה. אפשר לפנות גם בשנתיים הראשונות לרישיון; הנציג יבדוק את קבוצת הרכב והכיסוי המתאימים. אין לראות בתצוגת רכב בקטלוג אישור אוטומטי לנהג או לתאריכים שבחרתם.', en: 'Provide the driver’s age, licence issue date, licence category and rental dates. Enquiries are welcome within the first two years of holding a licence; the representative will check an appropriate vehicle group and cover. A catalogue listing is not automatic approval for a driver or the requested dates.' } },
      { heading: { he: 'נהג נוסף והתנאים לפני היציאה', en: 'Additional drivers and terms before collection' }, text: { he: 'אם יותר מאדם אחד ינהג, ציינו מראש את כל הנהגים ובקשו בדיקת התאמה לכל אחד. כל נהג חייב להירשם בחוזה ולהיות מכוסה בהתאם לתנאים. בדקו בהצעה את הכיסוי, ההשתתפות העצמית, הפיקדון וכל תוספת רלוונטית; מגבלות הנהיגה החלות על הנהג ממשיכות לחול גם ברכב שכור.', en: 'If more than one person will drive, identify all drivers in advance and request an eligibility check for each. Every driver must be registered in the agreement and covered under its terms. Check cover, excess, deposit and applicable charges in the quote; restrictions applying to a driver still apply in a rental car.' } },
    ],
  },
  sale: {
    title: { he: 'רכבים משומשים למכירה מצי ההשכרה | SmartCar', en: 'Used Cars for Sale from Our Rental Fleet | SmartCar' },
    description: { he: 'רכבים משומשים למכירה מצי ההשכרה של SmartCar. לכל רכב אפשר לקבל נתונים ומסמכים זמינים לפני ההחלטה. דברו איתנו על הרכב שמעניין אתכם.', en: 'Used cars for sale from the SmartCar rental fleet. For each car you can get its details and available documents before you decide. Ask us about any car.' },
    sections: [
      { heading: { he: 'משווים רכבים מהצי? בדקו את הרכב המסוים', en: 'Compare the specific vehicle, not just the model' }, text: { he: 'שנת דגם או תמונת המחשה אינן מספיקות כדי להשוות רכבים למכירה. בקשו את הקילומטרים, פרטי הבעלות והמסמכים הזמינים לגבי הרכב שמעניין אתכם. ודאו אילו פרטים נבדקו ומה עוד דורש בירור; אין להניח שלכל הרכבים אותה היסטוריה או אותם תנאי מכירה.', en: 'A model year or illustrative photo is not enough to compare cars for sale. Request mileage, ownership details and available documents for the vehicle you are considering. Clarify what has been checked and what still needs confirmation; histories and sale terms are not identical across vehicles.' } },
      { heading: { he: 'מה מבררים לפני החלטת רכישה?', en: 'What should you clarify before buying?' }, text: { he: 'בקשו מחיר ותנאי עסקה בכתב, מידע על המסמכים שניתן לקבל ואפשרות לתיאום צפייה ובירור בדיקה. אחריות, מימון או התחייבויות אחרות קיימים רק אם הוצעו ואושרו במפורש לגבי העסקה המסוימת. צוות SmartCar זמין לבירור הפרטים לפני קבלת החלטה.', en: 'Request the price and sale terms in writing, details of available documents and arrangements for viewing and discussing an inspection. Warranty, finance or other commitments apply only when explicitly offered and confirmed for that transaction. Ask SmartCar to clarify the details before deciding.' } },
    ],
  },
  leasing: {
    title: { he: 'ליסינג פרטי ועסקי – איך זה עובד ומה כלול | SmartCar', en: 'Private & Business Leasing – How It Works | SmartCar' },
    description: { he: 'מה ההבדל בין ליסינג פרטי לעסקי, מה כלול במסלול ואיך בוחרים תקופה וקילומטרים? כל מה שכדאי לדעת לפני ליסינג ב-SmartCar, והצעה כתובה לפני ההחלטה.', en: 'Private vs business leasing, what a plan includes and how to choose the term and mileage. What to know before leasing with SmartCar, with a written quote first.' },
    sections: [
      { heading: { he: 'איך משווים מסלולי ליסינג?', en: 'How should you compare leasing plans?' }, text: { he: 'התחילו בתקופת השימוש ובמספר הקילומטרים השנתי שאתם צפויים לנסוע. לאחר מכן השוו את התשלום, השירותים, הביטוח, התחזוקה ותנאי השינוי או סיום ההתקשרות לפי כל הצעה. לא כל מסלול כולל את אותם מרכיבים; בקשו פירוט כתוב לפני בחירת רכב.', en: 'Start with the period you need the vehicle and your expected annual mileage. Then compare payments, services, cover, maintenance and change or termination conditions in each quote. Plans do not all include the same items; request a written breakdown before choosing.' } },
      { heading: { he: 'ליסינג לפרטי, לעסק או לצי רכבים', en: 'A plan for private use, a business or a fleet' }, text: { he: 'ללקוח פרטי חשוב להתאים את הרכב לשגרת הנסיעות; לעסק כדאי לציין גם כמה רכבים נדרשים ומה אופי השימוש של העובדים. אם הצורך קצר יותר או שעדיין אין תקופה מוגדרת, אפשר להשוות גם השכרה חודשית. ההצעה הסופית מותאמת לפרטים ונבדקת עם נציג.', en: 'For private use, match the car to your everyday travel. For a business, also specify the number of vehicles and how employees will use them. If your need is shorter or the end date is uncertain, compare monthly rental too. A representative reviews the details for the final quote.' } },
    ],
  },
  monthly: {
    title: { he: 'השכרת רכב לחודש – השכרה חודשית וארוכת טווח | SmartCar', en: 'Monthly Car Rental in Israel – Long-Term Hire | SmartCar' },
    description: { he: 'השכרת רכב לחודש או לכמה חודשים ב-SmartCar, בלי התחייבות ארוכה של ליסינג. בחרו רכב, תקופה וקילומטרים, קבלו הצעת מחיר כתובה ומסירה עד הבית.', en: 'Rent a car for a month or several months with SmartCar, without a long leasing commitment. Choose the car, term and mileage, get a written quote and home delivery.' },
    sections: [
      { heading: { he: 'מה להשוות בהצעת השכרה חודשית?', en: 'What should a monthly rental quote explain?' }, text: { he: 'בדקו את התאריכים המדויקים, קבוצת הרכב, מכסת הקילומטרים, הכיסוי הביטוחי וההשתתפות העצמית, הפיקדון ועלויות מסירה או החזרה. סכום חודשי לבדו אינו מספיק להשוואה: בקשו שהמרכיבים הרלוונטיים יהיו ברורים בהצעה הכתובה.', en: 'Check exact dates, vehicle group, mileage allowance, cover and excess, deposit, and any delivery or return charges. A monthly figure alone is not enough to compare offers: ask for the relevant items to be clear in the written quote.' } },
      { heading: { he: 'השכרה לחודש או ליסינג?', en: 'Monthly rental or leasing?' }, text: { he: 'כשמשך הצורך עדיין לא ברור, הסבירו זאת לנציג ובדקו את תנאי התקופה, ההארכה והשינוי. לצורך ארוך ומוגדר אפשר להשוות גם ליסינג לפי משך וקילומטרים. אין להניח שביטוח, תחזוקה או יציאה מוקדמת כלולים באותו אופן בשני המסלולים.', en: 'If your end date is uncertain, explain that and check the term, extension and change conditions. For a defined long-term need, also compare leasing by duration and mileage. Do not assume that cover, maintenance or early termination work the same way in both arrangements.' } },
    ],
  },
  daily: {
    title: { he: 'השכרת רכב ליום ולסוף שבוע | SmartCar', en: 'Daily & Weekend Car Rental in Israel | SmartCar' },
    description: { he: 'השכרת רכב ליום, לכמה ימים או לסוף שבוע ב-SmartCar. בחרו רכב ותאריכים, אספו מאחד מארבעת הסניפים או קבלו את הרכב עד הבית בכל הארץ.', en: 'Rent a car for a day, a few days or a weekend with SmartCar. Choose the car and dates, then collect it from one of four branches or have it delivered anywhere in Israel.' },
    sections: [
      { heading: { he: 'מתכננים נסיעה קצרה? התחילו בזמנים ובמיקום', en: 'Start a short rental with dates, times and locations' }, text: { he: 'ציינו את מועד האיסוף וההחזרה ואת שני המיקומים, גם אם הם שונים. לאחר מכן בחרו קבוצת רכב לפי הנוסעים והמטען. המחיר עשוי להשתנות לפי התקופה והתנאים; בקשת השכרה באתר אינה אישור זמינות והאומדן אינו המחיר הסופי.', en: 'Provide collection and return dates, times and both locations, even if they differ. Then choose a vehicle group for your passengers and luggage. Pricing can vary by period and terms; a website request is not availability confirmation and the estimate is not the final price.' } },
    ],
  },
  hourly: {
    title: { he: 'השכרת רכב לפי שעה – רכב לכמה שעות | SmartCar', en: 'Hourly Car Rental in Israel – Rent by the Hour | SmartCar' },
    description: { he: 'צריכים רכב לכמה שעות לפגישה, לסידורים או להעברה? השכרת רכב לפי שעה ב-SmartCar – שלחו מיקום ושעות ונחזור אליכם עם רכב מתאים.', en: 'Need a car for a few hours for a meeting, errands or a transfer? Hourly car rental with SmartCar – send the location and times and we will come back with a car.' },
    sections: [
      { heading: { he: 'מה כדאי לציין בבקשה להשכרה לפי שעה?', en: 'What should an hourly rental enquiry include?' }, text: { he: 'שלחו את יום הנסיעה, שעת האיסוף וההחזרה, המיקום וקבוצת הרכב הדרושה. כדאי לציין גם את מרחק הנסיעה הצפוי. נציג יבדוק אם ניתן להתאים השכרה קצרה ויבהיר מחיר, מכסת קילומטרים ותנאים; אין באתר תעריף שעתי אחיד או התחייבות לאישור אוטומטי.', en: 'Include the day, collection and return times, location and vehicle group. Expected distance is also useful. A representative will check whether a short rental can be arranged and explain the price, mileage and terms; the website does not offer a universal hourly rate or automatic approval.' } },
    ],
  },
};

export function rentalCopy(copy: Copy, locale: string): string {
  return locale === 'he' ? copy.he : copy.en;
}

export const NATIONAL_RENTAL_ADVICE: RentalAdvice = {
  title: { he: 'רכבים להשכרה – מחיר ליום ומסירה עד הבית | SmartCar', en: 'Rental Cars in Israel – Daily Prices & Delivery | SmartCar' },
  description: { he: 'כל הרכבים להשכרה ב-SmartCar במקום אחד: קטנים, משפחתיים, SUV, 7 מקומות ומסחריים. בחרו תאריכים, ראו מחיר משוער ליום ושלחו בקשה – מסניף או עד הבית.', en: 'All SmartCar rental cars in one place: small, family, SUV, 7-seat and commercial. Pick your dates, see an estimated daily price and send a request – branch or delivery.' },
  sections: [
    { heading: { he: 'איך לבחור רכב להשכרה בישראל?', en: 'How do you choose a rental car in Israel?' }, text: { he: 'התחילו במספר הנוסעים, כמות המזוודות וסוג הנסיעות. רכב קומפקטי עשוי להתאים לנסיעות עירוניות; למשפחה או לנסיעות ממושכות כדאי להשוות גם מרחב ונפח מטען. באתר מוצג מבחר מהצי, והדגם או הקבוצה הסופיים מאושרים עם נציג לאחר בדיקת הזמינות לתאריכים שלכם.', en: 'Start with passengers, luggage and the trips you plan to make. A compact car may suit city driving; families and longer trips should also compare space and luggage capacity. The website shows a fleet selection, and a representative confirms the final model or group after checking your dates.' } },
    { heading: { he: 'מה חשוב לבדוק מעבר למחיר היומי?', en: 'What matters beyond the daily rate?' }, text: { he: 'השוו את התקופה המלאה, מכסת הקילומטרים, הכיסוי הביטוחי, ההשתתפות העצמית, הפיקדון ועלויות שירות במיקומים שבחרתם. אומדן באתר הוא כלי לתכנון ולא מחיר סופי. נציג SmartCar מאשר את הפרטים והתנאים בכתב לפני ההשכרה.', en: 'Compare the full rental period, mileage allowance, cover, excess, deposit and location-related service charges. A website estimate is a planning aid, not a final price. A SmartCar representative confirms the details and terms in writing before rental.' } },
    { heading: { he: 'איסוף והחזרה ברחבי הארץ', en: 'Collection and return across Israel' }, text: { he: 'אפשר לבחור איסוף בסניף ולבקש מסירה או החזרה בכתובת אחרת בישראל. ציינו את שני המיקומים, התאריכים והשעות כדי לבדוק את השירות והעלות. מסירה והחזרה מחייבות תיאום ואישור, ואינן הבטחה שכל כתובת או שעה זמינות.', en: 'Choose branch collection or request delivery or return at another address in Israel. Give both locations, dates and times so the team can check the service and cost. Delivery and return need coordination and confirmation; not every address or time is guaranteed to be available.' } },
  ],
};
