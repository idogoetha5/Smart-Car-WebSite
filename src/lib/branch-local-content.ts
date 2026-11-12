import type { BranchId } from '@/lib/branches';

// Local information for the four branch landing pages ("השכרת רכב ב<עיר>").
// Competing branch pages that rank (Eldan, Suncar, Shlomo Sixt, Hertz) add
// directions, parking, driving distances, local driving tips and a longer FAQ;
// ours had about 300 words. Everything here is either general public
// knowledge about the city (rounded, "about") or a SmartCar fact already
// published elsewhere on the site (faq-data.ts, terms, branch hours, owner-
// confirmed ₪150 airport fee and Shabbat surcharge). No prices or pricing
// rules here.

type L = { he: string; en: string };
export type BranchLocal = {
  arrival: L;
  distances: { to: L; km: number }[];
  tips: L[];
  questions: { q: L; a: L }[];
};

const SHABBAT_BRANCH: { q: L; a: L } = {
  q: { he: 'אפשר לאסוף או להחזיר רכב בשבת?', en: 'Can I collect or return a car on Saturday?' },
  a: {
    he: 'הסניף סגור בשבת, ולכן כדאי לאסוף ביום שישי ולהחזיר ביום ראשון. אם צריך מסירה או החזרה בשבת, אפשר לבקש תיאום מראש; שירות בשבת עשוי להיות כרוך בתוספת תשלום.',
    en: 'The branch is closed on Saturday, so it is usually easiest to collect on Friday and return on Sunday. Delivery or return on Saturday can be requested in advance and may carry an extra charge.',
  },
};
const DOCUMENTS: { q: L; a: L } = {
  q: { he: 'אילו מסמכים צריך להביא?', en: 'Which documents should I bring?' },
  a: {
    he: 'תעודת זהות או דרכון, רישיון נהיגה מקורי בתוקף וכרטיס אשראי על שם השוכר לפיקדון. כל נהג נוסף צריך להציג רישיון ולהירשם בחוזה. אפשר לשכור מגיל 21, גם נהגים חדשים.',
    en: 'An ID card or passport, a valid original driving licence and a credit card in the renter\'s name for the deposit. Every additional driver must show a licence and be on the agreement. Rental is available from age 21, including new drivers.',
  },
};
const DELIVERY_HOTEL: { q: L; a: L } = {
  q: { he: 'אפשר לקבל את הרכב במלון או בבית?', en: 'Can the car be delivered to my hotel or home?' },
  a: {
    he: 'כן. במקום להגיע לסניף אפשר לתאם מסירה לכתובת שלכם – מלון, בית או משרד – והחזרה בכתובת אחרת, בכפוף לזמינות. המחיר נקבע לפי הכתובות והשעות ומאושר מראש.',
    en: 'Yes. Instead of coming to the branch you can arrange delivery to your address – hotel, home or office – and return elsewhere, subject to availability. The price depends on the addresses and times and is confirmed in advance.',
  },
};

export const BRANCH_LOCAL: Record<BranchId, BranchLocal> = {
  telaviv: {
    arrival: {
      he: 'הסניף נמצא ברחוב הירקון 112, ברצועת המלונות שלאורך החוף וקרוב לטיילת. מי שמגיע ברגל מהמלונות שבאזור יכול לאסוף את הרכב ישירות מהסניף; מי שמעדיף לא להגיע יכול לבקש מסירה למלון או לכתובת אחרת בעיר.',
      en: 'The branch is at HaYarkon 112, on the hotel strip along the beach and close to the promenade. Guests at nearby hotels can walk over and collect the car; anyone who prefers not to come in can ask for delivery to a hotel or another address in the city.',
    },
    distances: [
      { to: { he: 'נמל התעופה בן גוריון', en: 'Ben Gurion Airport' }, km: 20 },
      { to: { he: 'הרצליה', en: 'Herzliya' }, km: 15 },
      { to: { he: 'ירושלים', en: 'Jerusalem' }, km: 65 },
      { to: { he: 'חיפה', en: 'Haifa' }, km: 95 },
      { to: { he: 'ים המלח (עין גדי)', en: 'Dead Sea (Ein Gedi)' }, km: 150 },
      { to: { he: 'אילת', en: 'Eilat' }, km: 350 },
    ],
    tips: [
      {
        he: 'חניה בשוליים המסומנים בכחול-לבן היא בתשלום, בדרך כלל דרך אפליקציית חניה. בחלק מהרחובות החניה שמורה לתושבי האזור בשעות מסוימות – בדקו את השלט לפני שמחנים.',
        en: 'Parking at blue-and-white kerbs is paid, usually through a parking app. Some streets are reserved for residents at certain hours – check the sign before parking.',
      },
      {
        he: 'בצירים מרכזיים יש נתיבי תחבורה ציבורית שאסורים לרכב פרטי בשעות הפעילות שלהם. רכב קטן נוח יותר לחניה ולנסיעה בעיר; ליציאה משפחתית מחוץ לעיר מתאים רכב גדול יותר.',
        en: 'Main roads have bus lanes that private cars may not use during their hours. A small car is easier to park and drive in the city; for a family trip out of town a larger car suits better.',
      },
      {
        he: 'היציאה מהעיר לכביש 1 (ירושלים ונתב״ג) ולכביש 2 (צפונה) עמוסה בשעות הבוקר ואחר הצהריים. כדאי לתכנן איסוף או החזרה מחוץ לשעות העומס.',
        en: 'Leaving the city towards Road 1 (Jerusalem and the airport) and Road 2 (north) is busy in the morning and late afternoon. Plan collection or return outside rush hours where possible.',
      },
    ],
    questions: [SHABBAT_BRANCH, DELIVERY_HOTEL, DOCUMENTS],
  },
  herzliya: {
    arrival: {
      he: 'הסניף הראשי של SmartCar נמצא ברמת ים 122 בהרצליה, ליד מלון דן אכדיה ובקרבת אזור המלונות והחוף. מכאן נוח לצאת לכביש 2 צפונה ודרומה ולהגיע להרצליה פיתוח, לרעננה ולכפר סבא.',
      en: 'The SmartCar main branch is at Ramat Yam 122 in Herzliya, by the Dan Accadia hotel and close to the hotels and the beach. From here it is easy to reach Road 2 north and south, Herzliya Pituach, Ra\'anana and Kfar Saba.',
    },
    distances: [
      { to: { he: 'תל אביב', en: 'Tel Aviv' }, km: 15 },
      { to: { he: 'נתניה', en: 'Netanya' }, km: 20 },
      { to: { he: 'נמל התעופה בן גוריון', en: 'Ben Gurion Airport' }, km: 30 },
      { to: { he: 'ירושלים', en: 'Jerusalem' }, km: 75 },
      { to: { he: 'חיפה', en: 'Haifa' }, km: 80 },
    ],
    tips: [
      {
        he: 'אזור התעסוקה של הרצליה פיתוח עמוס בשעות הבוקר והערב. לנסיעות עבודה כדאי לציין בבקשה את שעות האיסוף וההחזרה כדי שהרכב יהיה מוכן בזמן.',
        en: 'The Herzliya Pituach business district is busy in the morning and evening. For work trips, include collection and return times in your request so the car is ready on time.',
      },
      {
        he: 'החניה ברחובות המסומנים בכחול-לבן היא בתשלום, בדרך כלל דרך אפליקציית חניה. ליד החוף ובאזור המרינה יש חניונים, שחלקם בתשלום.',
        en: 'Parking on blue-and-white streets is paid, usually through a parking app. There are car parks near the beach and marina, some of them paid.',
      },
    ],
    questions: [SHABBAT_BRANCH, DELIVERY_HOTEL, DOCUMENTS],
  },
  jerusalem: {
    arrival: {
      he: 'הסניף נמצא ברחוב המלך דוד 8, במרכז העיר ליד ממילא ובקרבת מלונות רבים. מי שמתארח באזור יכול להגיע ברגל; אפשר גם לבקש מסירה למלון או לכתובת אחרת בירושלים.',
      en: 'The branch is at King David 8 in the city centre, near Mamilla and many hotels. Guests nearby can walk over; delivery to a hotel or another Jerusalem address can also be arranged.',
    },
    distances: [
      { to: { he: 'נמל התעופה בן גוריון', en: 'Ben Gurion Airport' }, km: 50 },
      { to: { he: 'תל אביב', en: 'Tel Aviv' }, km: 65 },
      { to: { he: 'ים המלח (עין גדי)', en: 'Dead Sea (Ein Gedi)' }, km: 85 },
      { to: { he: 'מצדה', en: 'Masada' }, km: 100 },
      { to: { he: 'אילת', en: 'Eilat' }, km: 310 },
    ],
    tips: [
      {
        he: 'אסור לנסוע על מסילות הרכבת הקלה ובנתיבי התחבורה הציבורית. במרכז העיר כדאי רכב קטן ונוח לחניה; לטיול לים המלח ולמדבר מתאים רכב עם מנוע חזק יותר ומיזוג טוב.',
        en: 'Do not drive on light-rail tracks or in bus lanes. In the city centre a small car is easier to park; for a trip to the Dead Sea and the desert, choose a car with more power and good air conditioning.',
      },
      {
        he: 'בשבת ובחגים חלק מהרחובות והשכונות סגורים לתנועה. תכננו את המסלול מראש ואת זמני האיסוף וההחזרה בהתאם.',
        en: 'On Saturdays and holidays some streets and neighbourhoods are closed to traffic. Plan your route and collection and return times accordingly.',
      },
      {
        he: 'החניה בשוליים המסומנים בכחול-לבן היא בתשלום, בדרך כלל דרך אפליקציית חניה. סביב ממילא והעיר העתיקה יש חניונים ציבוריים, שרובם בתשלום.',
        en: 'Parking at blue-and-white kerbs is paid, usually through a parking app. There are public car parks around Mamilla and the Old City, most of them paid.',
      },
    ],
    questions: [SHABBAT_BRANCH, DELIVERY_HOTEL, DOCUMENTS],
  },
  airport: {
    arrival: {
      he: 'ב-SmartCar לא צריך לחפש דלפק או לחכות להסעה לחניון השכרה מרוחק: נציג פוגש אתכם עם הרכב בנמל התעופה בן גוריון, בנקודת מפגש שמאושרת מראש, ומקבל את הרכב בחזרה לפני הטיסה. השירות זמין 24/7 בתיאום מראש.',
      en: 'With SmartCar there is no counter to find and no shuttle to an off-site rental lot: a representative meets you with the car at Ben Gurion Airport at a meeting point agreed in advance, and collects it again before your flight. Available 24/7 by prior arrangement.',
    },
    distances: [
      { to: { he: 'תל אביב', en: 'Tel Aviv' }, km: 20 },
      { to: { he: 'הרצליה', en: 'Herzliya' }, km: 30 },
      { to: { he: 'ירושלים', en: 'Jerusalem' }, km: 50 },
      { to: { he: 'חיפה', en: 'Haifa' }, km: 110 },
      { to: { he: 'אילת', en: 'Eilat' }, km: 330 },
    ],
    tips: [
      {
        he: 'שלחו מספר טיסה, שעת נחיתה משוערת, מספר נוסעים וכמות מזוודות. כך נוכל להתאים רכב בגודל הנכון ולתאם את זמן המפגש לפי שעת הנחיתה.',
        en: 'Send your flight number, estimated landing time, number of passengers and luggage. That lets us match the right size of car and plan the meeting time around your landing.',
      },
      {
        he: 'מנתב״ג נוסעים לתל אביב ולירושלים בכביש 1, ובשעות העומס הנסיעה ארוכה יותר. כדאי להביא זאת בחשבון כשמתכננים את שעת ההחזרה לפני הטיסה.',
        en: 'From the airport, Road 1 leads to Tel Aviv and Jerusalem, and the drive takes longer at rush hour. Allow for this when planning your return time before a flight.',
      },
    ],
    questions: [
      {
        q: { he: 'כמה עולה שירות המסירה בנתב״ג?', en: 'How much does the airport service cost?' },
        a: {
          he: 'איסוף או החזרה בנתב״ג כרוכים בתוספת של 150 ₪, שאינה כלולה במחיר המשוער של הרכב.',
          en: 'Collection or return at Ben Gurion Airport carries a ₪150 surcharge, which is not included in the car\'s estimated price.',
        },
      },
      {
        q: { he: 'אפשר לנחות בשבת או באמצע הלילה?', en: 'Can I land on Saturday or in the middle of the night?' },
        a: {
          he: 'כן, שירות נתב״ג זמין 24/7 בתיאום מראש. מסירה או החזרה בשבת עשויות להיות כרוכות בתוספת תשלום.',
          en: 'Yes, the airport service runs 24/7 by prior arrangement. Delivery or return on Saturday may carry an extra charge.',
        },
      },
      {
        q: { he: 'אפשר לאסוף בנתב״ג ולהחזיר בעיר אחרת?', en: 'Can I collect at the airport and return in another city?' },
        a: {
          he: 'כן. אפשר לאסוף בשדה ולהחזיר באחד הסניפים או בכתובת אחרת בארץ, ולהפך. ציינו את שני המיקומים כבר בבקשה, והמחיר יאושר מראש.',
          en: 'Yes. You can collect at the airport and return at a branch or another address in Israel, or the other way round. Give both locations in your request and the price is confirmed in advance.',
        },
      },
      DOCUMENTS,
    ],
  },
};
