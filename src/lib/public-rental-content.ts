import type { BranchId } from '@/lib/branches';

type Copy = { he: string; en: string };
// The catalogue/quote hub and the service explainer are different destinations.
// Keep both public, with distinct search intent rather than hiding either one.
export const LEASING_CATALOG_SEARCH = {
  title: { he: 'ליסינג פרטי ועסקי – בחירת רכב ובקשת הצעה | SmartCar', en: 'Leasing Vehicles in Israel – Compare & Request a Quote | SmartCar' },
  description: { he: 'בחרו רכב לליסינג פרטי או עסקי ממבחר SmartCar, השוו קבוצות רכב ושלחו בקשה לפי תקופה וקילומטרים. המחיר והתנאים הסופיים מאושרים בהצעה כתובה.', en: 'Compare SmartCar vehicles for private or business leasing in Israel. Choose a vehicle group and request a quote by term and mileage. Final pricing and terms require written confirmation.' },
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
    title: { he: 'השכרת רכב בתל אביב – הירקון 112 ומסירה בתיאום | SmartCar', en: 'Tel Aviv Car Rental – HaYarkon 112 | SmartCar' },
    description: { he: 'השכרת רכב בתל אביב בסניף הירקון 112, ליד הטיילת. השוו קבוצות רכב, בדקו השכרה יומית או חודשית ותאמו איסוף או מסירה עם נציג SmartCar.', en: 'Rent a car in Tel Aviv at HaYarkon 112, near the promenade. Compare vehicle groups, explore daily or monthly rental and arrange collection or delivery with SmartCar.' },
    sections: [
      { heading: { he: 'רכב לביקור בעיר או ליציאה מתל אביב?', en: 'Staying in Tel Aviv or heading out of the city?' }, text: { he: 'לנסיעות עירוניות כדאי להשוות גם מידות רכב ונוחות חניה, ולא רק מחיר יומי. ליציאה משפחתית מהעיר חשוב לבדוק מקום לנוסעים ולמזוודות. אם אתם אוספים מהירקון 112, ציינו מראש את שעות האיסוף וההחזרה הרצויות כדי שנציג יבדוק מה אפשר לתאם.', en: 'For city driving, compare vehicle size and parking practicality as well as the daily rate. For a family trip beyond Tel Aviv, consider passengers and luggage. When collecting at HaYarkon 112, give your preferred collection and return times so a representative can check the arrangements.' } },
      { heading: { he: 'השכרה ליום, לסוף שבוע או לחודש', en: 'A day, a weekend or a month' }, text: { he: 'לביקור קצר בחרו תאריכים ומקום איסוף; לצורך ממושך כדאי לציין גם נסועה צפויה ולבקש הצעה לתקופה כולה. השכרה חודשית וליסינג הם מסלולים שונים: השוו תקופה, קילומטרים, ביטוח ושירותים לפי ההצעה הכתובה, ולא רק את התשלום החודשי.', en: 'For a short visit, choose dates and a collection point. For a longer stay, include expected mileage and ask for a quote covering the full period. Monthly rental and leasing are different arrangements: compare the term, mileage, cover and services in the written quote, not just the monthly payment.' } },
      { heading: { he: 'איסוף בסניף או מסירה לכתובת בתל אביב', en: 'Branch collection or delivery to a Tel Aviv address' }, text: { he: 'אפשר לבקש איסוף בסניף או לתאם מסירה והחזרה בכתובת אחרת. ציינו כתובת, תאריכים ושעות; נציג יאשר זמינות, עלות ונקודת מפגש. מסירה למלון או החזרה במקום אחר אינן נכללות אוטומטית במחיר המוצג באתר.', en: 'You can request branch collection or arrange delivery and return at another address. Provide the address, dates and times; a representative will confirm availability, cost and the meeting point. Hotel delivery or a different return location is not automatically included in the website estimate.' } },
    ],
  },
  herzliya: {
    title: { he: 'השכרת רכב בהרצליה – רמת ים 122, ליד החוף | SmartCar', en: 'Herzliya Car Rental – Ramat Yam 122 | SmartCar' },
    description: { he: 'השכרת רכב בהרצליה ברמת ים 122, באזור דן אכדיה. רכבים לנסיעות עבודה, לחופשה או לתקופה ממושכת, עם איסוף ומסירה בתיאום מראש.', en: 'Car rental in Herzliya at Ramat Yam 122, by Dan Accadia. Explore cars for business, holidays or longer stays, with collection and delivery arranged in advance.' },
    sections: [
      { heading: { he: 'רכב להרצליה פיתוח, לחופשה או לנסיעות בשרון', en: 'Business in Herzliya Pituach or a stay on the coast' }, text: { he: 'סניף הרצליה נמצא ברמת ים 122. בבקשה לנסיעת עבודה כדאי לציין את משך השימוש והנסועה הצפויה; לחופשה משפחתית ציינו מספר נוסעים ומזוודות. כך אפשר להשוות קבוצות רכב לפי השימוש בפועל לפני שנציג מאשר את ההשכרה.', en: 'The Herzliya branch is at Ramat Yam 122. For business use, include the rental period and expected mileage; for a family holiday, give passenger and luggage needs. This helps compare vehicle groups for your trip before a representative confirms the rental.' } },
      { heading: { he: 'איסוף בהרצליה והחזרה במקום אחר', en: 'Collect in Herzliya and return elsewhere' }, text: { he: 'אם הטיול מתחיל בהרצליה ומסתיים בעיר אחרת, ציינו את שתי הכתובות ואת השעות המבוקשות. אפשר לבקש מסירה והחזרה בתיאום; השירות והמחיר תלויים במיקום, בשעה ובזמינות, ומאושרים עם הנציג.', en: 'If your trip starts in Herzliya and ends elsewhere, include both locations and preferred times. Delivery and return can be requested by arrangement; the service and price depend on location, timing and availability and are confirmed with the representative.' } },
    ],
  },
  jerusalem: {
    title: { he: 'השכרת רכב בירושלים – מלך דוד 8, ליד ממילא | SmartCar', en: 'Jerusalem Car Rental – King David 8 | SmartCar' },
    description: { he: 'השכרת רכב בירושלים בסניף מלך דוד 8, סמוך לממילא. השוו רכב לביקור בעיר או לטיול בארץ ותאמו איסוף, החזרה או מסירה מראש.', en: 'Rent a car in Jerusalem at King David 8, near Mamilla. Compare vehicles for the city or a trip around Israel and arrange collection, return or delivery in advance.' },
    sections: [
      { heading: { he: 'בחירת רכב לביקור בירושלים ולטיול מחוץ לעיר', en: 'Choosing a car for Jerusalem and trips beyond it' }, text: { he: 'הסניף נמצא במלך דוד 8, סמוך לממילא. לנסיעות בתוך העיר כדאי להביא בחשבון את מידות הרכב והחניה ביעד; לנסיעה עם משפחה מחוץ לעיר בדקו גם נפח מטען ונוחות לנוסעים. ציינו בבקשה את מספר הנוסעים והמזוודות כדי לקבל התאמה עניינית.', en: 'The branch is at King David 8, near Mamilla. For city trips, consider vehicle size and parking at your destination; for family travel beyond Jerusalem, also compare luggage space and passenger comfort. Include passenger and luggage needs in your request.' } },
      { heading: { he: 'מתכננים איסוף בירושלים והחזרה בנתב״ג?', en: 'Collecting in Jerusalem and returning at Ben Gurion Airport?' }, text: { he: 'ציינו את שני המיקומים, התאריכים והשעות כבר בפנייה. ניתן לבקש תיאום מסירה או החזרה במיקום אחר, בכפוף לאישור נציג. שירות בנתב״ג כרוך בתוספת תשלום שגובהה נקבע עם הנציג; אין להניח שהיא כלולה באומדן.', en: 'Include both locations, dates and times in your enquiry. Delivery or return at another location can be requested subject to representative confirmation. Airport service carries an additional charge agreed with the representative; do not assume it is included in the estimate.' } },
    ],
  },
  airport: {
    title: { he: 'השכרת רכב בנתב״ג – מסירה והחזרה בתיאום | SmartCar', en: 'Ben Gurion Airport Car Rental – Arranged Delivery | SmartCar' },
    description: { he: 'השכרת רכב בנמל התעופה בן גוריון: תאמו מסירה, החזרה ונקודת מפגש עם נציג SmartCar. שירות נתב״ג בתוספת תשלום שנקבעת עם הנציג.', en: 'Arrange car rental delivery and return at Ben Gurion Airport with SmartCar. A representative confirms the meeting point and the additional airport-service charge.' },
    sections: [
      { heading: { he: 'מה צריך לתאם לפני הנחיתה?', en: 'What should you arrange before arrival?' }, text: { he: 'שלחו תאריכים, שעות, מספר נוסעים וכמות מזוודות, וציינו שהאיסוף או ההחזרה בנתב״ג. נציג מאשר את הרכב או קבוצת הרכב, פרטי המסירה ונקודת המפגש. אם חל שינוי בטיסה, צרו קשר לעדכון; אל תסתמכו על שינוי אוטומטי בהזמנה.', en: 'Send dates, times, passenger and luggage needs, and specify airport collection or return. A representative confirms the vehicle or group, delivery arrangements and meeting point. If your flight changes, contact the team; do not assume the booking updates automatically.' } },
      { heading: { he: 'מחיר השירות והחזרה בעיר אחרת', en: 'Airport-service cost and returning in another city' }, text: { he: 'שירות נתב״ג הוא בתוספת תשלום שנקבעת עם הנציג. אפשר לבקש איסוף בשדה והחזרה בסניף אחר או להפך; יש לתאם את שני המיקומים מראש. האומדן באתר אינו מחיר סופי, והמחיר והתנאים מחייבים אישור כתוב לפני ההשכרה.', en: 'Airport service has an additional charge agreed with the representative. You can request airport collection and return at another branch, or the reverse; arrange both locations in advance. The website estimate is not a final price, and the price and terms require written confirmation before rental.' } },
    ],
  },
};

export const SERVICE_RENTAL_ADVICE: Record<string, RentalAdvice> = {
  business: {
    title: { he: 'השכרת רכב לעסקים ולציי רכב – פתרון לפי הצורך | SmartCar', en: 'Business Car Rental & Fleet Enquiries in Israel | SmartCar' },
    description: { he: 'השכרת רכב לעסקים: מרכב זמני לעובד ועד כמה רכבים לפעילות השוטפת. השוו תקופה, קבוצות רכב וקילומטרים וקבלו הצעה מותאמת מ-SmartCar.', en: 'Business car rental in Israel, from a temporary employee vehicle to several cars for daily operations. Compare vehicle groups, term and mileage with a tailored SmartCar quote.' },
    sections: [
      { heading: { he: 'רכב לעובד, לפרויקט או לכמה צוותים?', en: 'A vehicle for an employee, a project or several teams?' }, text: { he: 'ציינו כמה רכבים דרושים, מי צפוי לנהוג, היכן מתחילה העבודה ומה משך השימוש המשוער. לעובד שנוסע לפגישות ולצוות שמוביל ציוד יש צרכים שונים. התאימו את קבוצות הרכב למספר הנוסעים, למטען ולנסועה לפני שמשווים את עלות התקופה.', en: 'Specify how many vehicles you need, who will drive, where work starts and the expected period. An employee travelling to meetings and a team carrying equipment have different needs. Match vehicle groups to passengers, cargo and mileage before comparing the cost for the full period.' } },
      { heading: { he: 'השכרה עסקית או ליסינג לעסק?', en: 'Business rental or business leasing?' }, text: { he: 'לצורך זמני או לפרויקט עם מועד סיום משתנה, בקשו להשוות השכרה יומית או חודשית. לצורך ממושך ומוגדר בדקו גם מסלול ליסינג. בהצעה הכתובה חשוב לפרט תקופה, קילומטרים, נהגים מורשים, כיסוי, שירותים ותנאי שינוי; לא כל מסלול כולל אותם מרכיבים.', en: 'For a temporary need or a project with a changing end date, compare daily or monthly rental. For a defined longer-term need, also consider leasing. The written quote should explain the term, mileage, authorised drivers, cover, services and change conditions; inclusions differ between plans.' } },
    ],
  },
  commercial: {
    title: { he: 'השכרת רכב מסחרי – להובלה ולעבודה | SmartCar', en: 'Commercial Vehicle & Van Rental in Israel | SmartCar' },
    description: { he: 'השכרת רכב מסחרי להובלה, ציוד ועבודה. ציינו מידות מטען, משך שימוש ויעד כדי לבדוק קבוצה מתאימה, דרישות רישיון ותנאים עם SmartCar.', en: 'Enquire about commercial vehicle and van rental in Israel for cargo, equipment and work. Provide load dimensions, period and destination to check a suitable vehicle and terms.' },
    sections: [
      { heading: { he: 'מה מעמיסים וכמה מקום צריך?', en: 'What are you carrying and how much space do you need?' }, text: { he: 'לפני בחירת מסחרית מדדו את הפריטים הגדולים וציינו אורך, רוחב, גובה ומשקל משוער. בדקו עם הנציג את מידות תא המטען, פתח ההעמסה, מספר המושבים וכושר ההעמסה של הרכב שיוצע בפועל. תמונה או שם דגם לבדם אינם אישור שהמטען מתאים לרכב.', en: 'Before choosing a van, measure the largest items and provide their length, width, height and estimated weight. Ask the representative to confirm cargo space, loading opening, seats and payload for the actual vehicle offered. A photo or model name alone does not confirm that your load will fit.' } },
      { heading: { he: 'רישיון, תקופה ומסירה של רכב מסחרי', en: 'Licence, rental period and commercial-vehicle delivery' }, text: { he: 'ציינו מי ינהג, את סוג הרישיון ואת מועדי האיסוף וההחזרה. יש לוודא שהרישיון מתאים לרכב המסוים ולא להניח שכל מסחרית מתאימה לכל רישיון. להשכרה ממושכת בקשו הצעה לתקופה כולה, כולל מכסת קילומטרים, כיסוי ועלויות מסירה והחזרה אם נדרשות.', en: 'Provide the driver and licence category as well as collection and return dates. Confirm that the licence is appropriate for the specific vehicle; do not assume every van can be driven on every licence. For a longer rental, request a full-period quote with mileage, cover and any delivery or return charges.' } },
    ],
  },
  'new-driver': {
    title: { he: 'השכרת רכב לנהג חדש ולנהג צעיר מגיל 21 | SmartCar', en: 'New & Young Driver Car Rental from Age 21 | SmartCar' },
    description: { he: 'השכרת רכב לנהגים חדשים וצעירים מגיל 21 ב-SmartCar. בדקו התאמה לפי גיל, ותק רישיון, קבוצת רכב וכיסוי לפני אישור ההשכרה.', en: 'Explore SmartCar rental for new and young drivers from age 21. Check eligibility by age, licence history, vehicle group and cover before rental confirmation.' },
    sections: [
      { heading: { he: 'מה לציין כדי לבדוק התאמה לנהג?', en: 'What details help check driver eligibility?' }, text: { he: 'מסרו את גיל הנהג, מועד הוצאת הרישיון, סוג הרישיון ותאריכי ההשכרה. אפשר לפנות גם בשנתיים הראשונות לרישיון; הנציג יבדוק את קבוצת הרכב והכיסוי המתאימים. אין לראות בתצוגת רכב בקטלוג אישור אוטומטי לנהג או לתאריכים שבחרתם.', en: 'Provide the driver’s age, licence issue date, licence category and rental dates. Enquiries are welcome within the first two years of holding a licence; the representative will check an appropriate vehicle group and cover. A catalogue listing is not automatic approval for a driver or the requested dates.' } },
      { heading: { he: 'נהג נוסף והתנאים לפני היציאה', en: 'Additional drivers and terms before collection' }, text: { he: 'אם יותר מאדם אחד ינהג, ציינו מראש את כל הנהגים ובקשו בדיקת התאמה לכל אחד. כל נהג חייב להירשם בחוזה ולהיות מכוסה בהתאם לתנאים. בדקו בהצעה את הכיסוי, ההשתתפות העצמית, הפיקדון וכל תוספת רלוונטית; מגבלות הנהיגה החלות על הנהג ממשיכות לחול גם ברכב שכור.', en: 'If more than one person will drive, identify all drivers in advance and request an eligibility check for each. Every driver must be registered in the agreement and covered under its terms. Check cover, excess, deposit and applicable charges in the quote; restrictions applying to a driver still apply in a rental car.' } },
    ],
  },
  sale: {
    title: { he: 'רכבים מצי ההשכרה למכירה – מידע לכל רכב | SmartCar', en: 'Rental Fleet Cars for Sale in Israel | SmartCar' },
    description: { he: 'רכבים נבחרים מצי SmartCar למכירה. עיינו במבחר ובקשו נתוני רכב, מסמכים זמינים ותנאי עסקה לגבי הרכב הספציפי לפני החלטה.', en: 'Explore selected SmartCar fleet vehicles for sale in Israel. Request vehicle-specific details, available documents and sale terms before making your decision.' },
    sections: [
      { heading: { he: 'משווים רכבים מהצי? בדקו את הרכב המסוים', en: 'Compare the specific vehicle, not just the model' }, text: { he: 'שנת דגם או תמונת המחשה אינן מספיקות כדי להשוות רכבים למכירה. בקשו את הקילומטרים, פרטי הבעלות והמסמכים הזמינים לגבי הרכב שמעניין אתכם. ודאו אילו פרטים נבדקו ומה עוד דורש בירור; אין להניח שלכל הרכבים אותה היסטוריה או אותם תנאי מכירה.', en: 'A model year or illustrative photo is not enough to compare cars for sale. Request mileage, ownership details and available documents for the vehicle you are considering. Clarify what has been checked and what still needs confirmation; histories and sale terms are not identical across vehicles.' } },
      { heading: { he: 'מה מבררים לפני החלטת רכישה?', en: 'What should you clarify before buying?' }, text: { he: 'בקשו מחיר ותנאי עסקה בכתב, מידע על המסמכים שניתן לקבל ואפשרות לתיאום צפייה ובירור בדיקה. אחריות, מימון או התחייבויות אחרות קיימים רק אם הוצעו ואושרו במפורש לגבי העסקה המסוימת. צוות SmartCar זמין לבירור הפרטים לפני קבלת החלטה.', en: 'Request the price and sale terms in writing, details of available documents and arrangements for viewing and discussing an inspection. Warranty, finance or other commitments apply only when explicitly offered and confirmed for that transaction. Ask SmartCar to clarify the details before deciding.' } },
    ],
  },
  leasing: {
    title: { he: 'ליסינג פרטי ועסקי – לפי תקופה וקילומטרים | SmartCar', en: 'Private & Business Leasing in Israel | SmartCar' },
    description: { he: 'ליסינג פרטי ועסקי ב-SmartCar: התאימו רכב, תקופה וקילומטרים ובדקו אילו שירותים נכללים במסלול. קבלו הצעה כתובה לפני ההחלטה.', en: 'Explore private and business leasing in Israel with SmartCar. Match the vehicle, term and mileage, check included services and request a written quote before deciding.' },
    sections: [
      { heading: { he: 'איך משווים מסלולי ליסינג?', en: 'How should you compare leasing plans?' }, text: { he: 'התחילו בתקופת השימוש ובמספר הקילומטרים השנתי שאתם צפויים לנסוע. לאחר מכן השוו את התשלום, השירותים, הביטוח, התחזוקה ותנאי השינוי או סיום ההתקשרות לפי כל הצעה. לא כל מסלול כולל את אותם מרכיבים; בקשו פירוט כתוב לפני בחירת רכב.', en: 'Start with the period you need the vehicle and your expected annual mileage. Then compare payments, services, cover, maintenance and change or termination conditions in each quote. Plans do not all include the same items; request a written breakdown before choosing.' } },
      { heading: { he: 'ליסינג לפרטי, לעסק או לצי רכבים', en: 'A plan for private use, a business or a fleet' }, text: { he: 'ללקוח פרטי חשוב להתאים את הרכב לשגרת הנסיעות; לעסק כדאי לציין גם כמה רכבים נדרשים ומה אופי השימוש של העובדים. אם הצורך קצר יותר או שעדיין אין תקופה מוגדרת, אפשר להשוות גם השכרה חודשית. ההצעה הסופית מותאמת לפרטים ונבדקת עם נציג.', en: 'For private use, match the car to your everyday travel. For a business, also specify the number of vehicles and how employees will use them. If your need is shorter or the end date is uncertain, compare monthly rental too. A representative reviews the details for the final quote.' } },
    ],
  },
  monthly: {
    title: { he: 'השכרת רכב לחודש ולטווח ארוך – הצעה מותאמת | SmartCar', en: 'Monthly & Long-Term Car Rental in Israel | SmartCar' },
    description: { he: 'צריכים רכב לחודש או לתקופה ממושכת? השוו תקופה, קילומטרים, ביטוח ומסירה, וקבלו הצעה כתובה המותאמת לצורך שלכם מ-SmartCar.', en: 'Need a car for a month or a longer stay in Israel? Compare the term, mileage, cover and delivery, and request a written SmartCar quote matched to your needs.' },
    sections: [
      { heading: { he: 'מה להשוות בהצעת השכרה חודשית?', en: 'What should a monthly rental quote explain?' }, text: { he: 'בדקו את התאריכים המדויקים, קבוצת הרכב, מכסת הקילומטרים, הכיסוי הביטוחי וההשתתפות העצמית, הפיקדון ועלויות מסירה או החזרה. סכום חודשי לבדו אינו מספיק להשוואה: בקשו שהמרכיבים הרלוונטיים יהיו ברורים בהצעה הכתובה.', en: 'Check exact dates, vehicle group, mileage allowance, cover and excess, deposit, and any delivery or return charges. A monthly figure alone is not enough to compare offers: ask for the relevant items to be clear in the written quote.' } },
      { heading: { he: 'השכרה לחודש או ליסינג?', en: 'Monthly rental or leasing?' }, text: { he: 'כשמשך הצורך עדיין לא ברור, הסבירו זאת לנציג ובדקו את תנאי התקופה, ההארכה והשינוי. לצורך ארוך ומוגדר אפשר להשוות גם ליסינג לפי משך וקילומטרים. אין להניח שביטוח, תחזוקה או יציאה מוקדמת כלולים באותו אופן בשני המסלולים.', en: 'If your end date is uncertain, explain that and check the term, extension and change conditions. For a defined long-term need, also compare leasing by duration and mileage. Do not assume that cover, maintenance or early termination work the same way in both arrangements.' } },
    ],
  },
  daily: {
    title: { he: 'השכרת רכב ליום ולסוף שבוע – בקשה לפי תאריכים | SmartCar', en: 'Daily & Weekend Car Rental in Israel | SmartCar' },
    description: { he: 'השכרת רכב ליום, לכמה ימים או לסוף שבוע. בחרו קבוצת רכב, תאריכים ומיקומים, ונציג SmartCar יבדוק זמינות ויאשר מחיר ותנאים בכתב.', en: 'Request a car for a day, a few days or a weekend. Choose a vehicle group, dates and locations; SmartCar will check availability and confirm the price and terms in writing.' },
    sections: [
      { heading: { he: 'מתכננים נסיעה קצרה? התחילו בזמנים ובמיקום', en: 'Start a short rental with dates, times and locations' }, text: { he: 'ציינו את מועד האיסוף וההחזרה ואת שני המיקומים, גם אם הם שונים. לאחר מכן בחרו קבוצת רכב לפי הנוסעים והמטען. המחיר עשוי להשתנות לפי התקופה והתנאים; בקשת השכרה באתר אינה אישור זמינות והאומדן אינו המחיר הסופי.', en: 'Provide collection and return dates, times and both locations, even if they differ. Then choose a vehicle group for your passengers and luggage. Pricing can vary by period and terms; a website request is not availability confirmation and the estimate is not the final price.' } },
    ],
  },
  hourly: {
    title: { he: 'השכרת רכב לפי שעה – לכמה שעות בתיאום מראש | SmartCar', en: 'Hourly Car Rental in Israel – Enquire with SmartCar' },
    description: { he: 'צריכים רכב לכמה שעות לפגישה, לסידורים או לנסיעה? שלחו ל-SmartCar מיקום ושעות ובדקו זמינות, קבוצת רכב ותנאי השכרה לפני האישור.', en: 'Need a vehicle for a few hours? Send SmartCar the location and times, and check availability, vehicle group and rental terms before confirmation.' },
    sections: [
      { heading: { he: 'מה כדאי לציין בבקשה להשכרה לפי שעה?', en: 'What should an hourly rental enquiry include?' }, text: { he: 'שלחו את יום הנסיעה, שעת האיסוף וההחזרה, המיקום וקבוצת הרכב הדרושה. כדאי לציין גם את מרחק הנסיעה הצפוי. נציג יבדוק אם ניתן להתאים השכרה קצרה ויבהיר מחיר, מכסת קילומטרים ותנאים; אין באתר תעריף שעתי אחיד או התחייבות לאישור אוטומטי.', en: 'Include the day, collection and return times, location and vehicle group. Expected distance is also useful. A representative will check whether a short rental can be arranged and explain the price, mileage and terms; the website does not offer a universal hourly rate or automatic approval.' } },
    ],
  },
};

export function rentalCopy(copy: Copy, locale: string): string {
  return locale === 'he' ? copy.he : copy.en;
}

export const NATIONAL_RENTAL_ADVICE: RentalAdvice = {
  title: { he: 'השכרת רכב בישראל – בחירת רכב ומסירה בתיאום | SmartCar', en: 'Car Rental in Israel – Vehicles & Arranged Delivery | SmartCar' },
  description: { he: 'השכרת רכב בישראל עם SmartCar: השוו קבוצות רכב ובחרו תאריכים ומיקומי איסוף והחזרה. סניפים בתל אביב, בהרצליה ובירושלים ושירות נתב״ג בתיאום.', en: 'Compare car rental options in Israel with SmartCar. Choose vehicle groups, dates and collection and return locations, with branches in Tel Aviv, Herzliya and Jerusalem and arranged airport service.' },
  sections: [
    { heading: { he: 'איך לבחור רכב להשכרה בישראל?', en: 'How do you choose a rental car in Israel?' }, text: { he: 'התחילו במספר הנוסעים, כמות המזוודות וסוג הנסיעות. רכב קומפקטי עשוי להתאים לנסיעות עירוניות; למשפחה או לנסיעות ממושכות כדאי להשוות גם מרחב ונפח מטען. באתר מוצג מבחר מהצי, והדגם או הקבוצה הסופיים מאושרים עם נציג לאחר בדיקת הזמינות לתאריכים שלכם.', en: 'Start with passengers, luggage and the trips you plan to make. A compact car may suit city driving; families and longer trips should also compare space and luggage capacity. The website shows a fleet selection, and a representative confirms the final model or group after checking your dates.' } },
    { heading: { he: 'מה חשוב לבדוק מעבר למחיר היומי?', en: 'What matters beyond the daily rate?' }, text: { he: 'השוו את התקופה המלאה, מכסת הקילומטרים, הכיסוי הביטוחי, ההשתתפות העצמית, הפיקדון ועלויות שירות במיקומים שבחרתם. אומדן באתר הוא כלי לתכנון ולא מחיר סופי. נציג SmartCar מאשר את הפרטים והתנאים בכתב לפני ההשכרה.', en: 'Compare the full rental period, mileage allowance, cover, excess, deposit and location-related service charges. A website estimate is a planning aid, not a final price. A SmartCar representative confirms the details and terms in writing before rental.' } },
    { heading: { he: 'איסוף והחזרה ברחבי הארץ', en: 'Collection and return across Israel' }, text: { he: 'אפשר לבחור איסוף בסניף ולבקש מסירה או החזרה בכתובת אחרת בישראל. ציינו את שני המיקומים, התאריכים והשעות כדי לבדוק את השירות והעלות. מסירה והחזרה מחייבות תיאום ואישור, ואינן הבטחה שכל כתובת או שעה זמינות.', en: 'Choose branch collection or request delivery or return at another address in Israel. Give both locations, dates and times so the team can check the service and cost. Delivery and return need coordination and confirmation; not every address or time is guaranteed to be available.' } },
  ],
};
