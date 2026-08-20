import type { FlowState } from '@/lib/whatsapp-flow';

export type SalesStage = 'information' | 'considering' | 'objection' | 'ready' | 'handoff';
export type SalesPlay = {
  id: string; locale: 'he' | 'en'; trigger: string; knownContext: string; minimumMissing: string;
  reflection: string; response: string; nextAction: string; canSuggest: boolean; mustHandoff: boolean; forbidden: string;
};

type Seed = { key: string; heTrigger: string; enTrigger: string; heReflection: string; enReflection: string; heResponse: string; enResponse: string; heNext: string; enNext: string; canSuggest: boolean; mustHandoff: boolean };
const seeds: Seed[] = [
  ['price','יקר לי','too expensive','המחיר חשוב לך','Price matters to you','נבדוק קטגוריה שמתאימה לצורך, בלי להניח תקציב.','We can match a category to the trip without assuming a budget.','מה התקציב היומי שנוח לך?','What daily budget works for you?',true,false],
  ['thinking','אחשוב על זה','I will think about it','ברור שתרצה לשקול','It makes sense to consider it','אשמור את פרטי הבקשה; אין צורך להחליט עכשיו.','I’ll retain the request details; there is no need to decide now.','מה הדבר העיקרי שאתה עוד בודק?','What is the main thing you are still weighing?',true,false],
  ['competitor','מתחרה','another company','אתה משווה בין אפשרויות','You are comparing options','נוכל להשוות את הצורך והפרטים, לא להבטיח מחיר של חברה אחרת.','We can compare the need and details, without promising another company’s price.','איזה פרט חשוב לך להשוות?','Which detail matters most to compare?',true,false],
  ['choose','לא בטוח איזה רכב','not sure which car','אתה מחפש התאמה ולא רק שם של רכב','You want fit, not just a car name','נתאים קטגוריה לפי הנסיעה והצי יאושר בנפרד.','We can narrow a category by the trip; fleet availability is confirmed separately.','כמה נוסעים ומזוודות יהיו?','How many passengers and bags?',true,false],
  ['family','משפחה תינוק מזוודות','family baby luggage','רשמתי נסיעה משפחתית','I’ve noted a family trip','נבדוק מרחב, מושבים וציוד ילדים לפני המלצה.','We’ll consider space, seats and child equipment before recommending.','כמה נוסעים וכיסאות ילדים צריך?','How many passengers and child seats are needed?',true,false],
  ['luxury','רכב יוקרה','luxury car','אתה מחפש חוויית יוקרה','You are looking for a premium experience','אפשר לבקש קטגוריית יוקרה, אך לא להבטיח דגם מסוים.','You can request a luxury category, but not a specific model promise.','לאילו תאריכים ומיקום?','Which dates and location?',true,false],
  ['short','נסיעה קצרה','short trip','זו נסיעה קצרה','This is a short trip','נבדוק קטגוריה יעילה לצורך ולמסלול.','We’ll consider an efficient category for the need and route.','כמה ימים ומה המסלול?','How many days and what route?',true,false],
  ['long','נסיעה ארוכה','long trip','זו נסיעה ארוכה','This is a long trip','חשוב להתאים את קטגוריית הרכב ומכסת הקילומטרים.','Vehicle category and mileage allowance both matter here.','כמה ימים צפויים?','How many days are planned?',true,false],
  ['airport','שדה תעופה','airport','מדובר באיסוף או החזרה בשדה','This involves airport pickup or return','אפשר לבדוק מסלול כזה בכפוף לתיאום ולזמינות.','This can be checked subject to coordination and availability.','מה שעת הנחיתה או האיסוף?','What is the landing or pickup time?',false,false],
  ['young','נהג צעיר','young driver','רשמתי נהג צעיר','I’ve noted a young driver','הזכאות תלויה בכיסוי ובקבוצת הרכב.','Eligibility depends on coverage and vehicle group.','מה גיל הנהג וותק הרישיון?','What are the driver’s age and licence experience?',false,false],
  ['deposit','פיקדון','deposit','הפיקדון הוא פרט חשוב בהחלטה','The deposit is an important decision detail','אסביר את הסכום האינדיקטיבי והסכום הסופי נשאר בחוזה.','I can explain the indicative amount; the agreement sets the final amount.','איזו קטגוריה מעניינת?','Which category are you considering?',false,false],
  ['insurance','ביטוח','insurance','חשוב לך להבין את הכיסוי','You want to understand cover','יש כיסוי בסיסי והשתתפות עצמית לפי ההצעה והחוזה.','There is basic cover and an excess set by the quote and agreement.','רוצה קישור לפרטי הביטוח?','Would you like the insurance details link?',false,false],
  ['fuel','דלק','fuel','חשובה לך שקיפות על הדלק','Fuel transparency matters to you','המדיניות היא מלא־מלא; דלק חסר מחויב לפי מחיר שוק.','The policy is full-to-full; missing fuel is charged at market price.','רוצה לבדוק גם קילומטראז׳?','Would you like the mileage details too?',false,false],
  ['mileage','קילומטר','mileage','חשובה לך מכסת הקילומטרים','Mileage allowance matters to you','המכסה תלויה במשך ההשכרה והחריגה לפי החוזה.','The allowance depends on rental duration and excess is per agreement.','לכמה ימים נדרשת ההשכרה?','How many days do you need?',false,false],
  ['change','שינוי הארכה','change extend','צריך לשנות את הבקשה','You need to change the request','נשמור את הפרטים ונעביר לטיפול, בלי לשנות הזמנה אוטומטית.','We’ll retain details and route this for handling; no booking changes are made automatically.','מה מספר ההזמנה?','What is the booking reference?',false,true],
  ['unavailable','אין רכב','unavailable','הזמינות מדאיגה אותך','Availability is a concern','אם קטגוריה אינה זמינה, התנאים מתארים חלופה גבוהה יותר או החזר מלא אם אין רכב.','If a category is unavailable, the terms describe a higher-category alternative or a full refund if no car is available.','לאיזו קטגוריה ותאריכים?','Which category and dates?',false,true],
  ['discount','הנחה','discount','אתה מבקש חריג במחיר','You are asking for a price exception','אעביר בקשה לבחינה; אין הבטחת הנחה.','I’ll send the request for review; no discount is promised.','מה התאריכים והקטגוריה?','What are the dates and category?',false,true],
  ['returning','לקוח חוזר','returning customer','טוב שחזרת ל־SmartCar','Welcome back to SmartCar','נשתמש בפרטי ההזמנה הפעילה אם היא תואמת למספר.','We’ll use the active booking details if they match this number.','מה תרצה לעשות בהזמנה?','What would you like to do with the booking?',true,false],
  ['business','עסק חברה','business company','זו בקשה עסקית','This is a business request','נרכז את הצרכים להצעה כתובה; מחיר סופי לא נקבע כאן.','We’ll gather needs for a written quote; no final price is set here.','כמה כלי רכב או כמה זמן?','How many vehicles or how long?',false,true],
  ['urgent','דחוף לחוץ','urgent stressed','אני מבין שהזמן לחוץ','I understand time is tight','נשמור את הפרטים ונכוון לצעד המהיר הבא.','We’ll retain the details and focus on the quickest next step.','מה מועד האיסוף?','When is pickup?',false,true],
  ['trust','לא סומך','do not trust','חשוב לך לקבל תשובה ברורה','You need a clear answer','אציג רק תנאים שפורסמו; מה שתלוי בחוזה אסמן כך.','I’ll state only published terms and label what depends on the agreement.','איזה פרט תרצה לבדוק?','Which detail would you like to check?',false,false],
  ['silent','לא עונה','no reply','אפשר להשאיר את הבקשה פתוחה','You can leave the request open','לא נלחץ ולא נבטיח שמירת מחיר או זמינות.','We will not pressure you or promise to hold price or availability.','כשתרצה, כתוב תאריכים ומיקום.','When ready, send dates and location.',false,false],
  ['availability','זמינות לא ודאית','availability uncertain','הזמינות עדיין לא מאושרת','Availability is not confirmed yet','הבקשה אינה אישור; נציג מאשר צי ומחיר בכתב.','A request is not confirmation; an agent confirms fleet and price in writing.','מה הקטגוריה והתאריכים?','What category and dates?',false,true],
  ['ready','אני מאשר','ready to book','אתה מוכן להגיש בקשה','You are ready to submit a request','נבדוק שיש את כל הפרטים ונבקש אישור תנאים לפני שליחה.','We’ll ensure the details are complete and ask for terms consent before submission.','שלח שם ומייל אם חסרים.','Send name and email if missing.',false,false],
  ['messy','הודעה מבולגנת','mixed details','רשמתי את הפרטים הברורים','I’ve kept the clear details','לא אנחש נתון עמום; אבקש רק את החסר.','I will not guess an unclear fact; I’ll ask only for the gap.','מהו פרט האיסוף החסר?','What pickup detail is missing?',true,false],
].map(([key, heTrigger, enTrigger, heReflection, enReflection, heResponse, enResponse, heNext, enNext, canSuggest, mustHandoff]) => ({ key, heTrigger, enTrigger, heReflection, enReflection, heResponse, enResponse, heNext, enNext, canSuggest, mustHandoff } as unknown as Seed));

export const CONSULTATIVE_SALES_PLAYS: SalesPlay[] = seeds.flatMap((seed) => ([
  { id: `${seed.key}-he`, locale: 'he' as const, trigger: seed.heTrigger, knownContext: 'תאריכים, מסלול וצרכים שכבר נמסרו', minimumMissing: seed.heNext, reflection: seed.heReflection, response: seed.heResponse, nextAction: seed.heNext, canSuggest: seed.canSuggest, mustHandoff: seed.mustHandoff, forbidden: 'לחץ, הנחה, זמינות או מחיר מומצאים' },
  { id: `${seed.key}-en`, locale: 'en' as const, trigger: seed.enTrigger, knownContext: 'Dates, route and needs already shared', minimumMissing: seed.enNext, reflection: seed.enReflection, response: seed.enResponse, nextAction: seed.enNext, canSuggest: seed.canSuggest, mustHandoff: seed.mustHandoff, forbidden: 'Artificial urgency, invented discount, availability or price' },
]));

export function findConsultativeSalesPlay(input: string, locale: 'he' | 'en') {
  const text = input.toLowerCase();
  return CONSULTATIVE_SALES_PLAYS.find((play) => play.locale === locale && text.includes(play.trigger.toLowerCase())) ?? null;
}

export function consultativeSalesReply(input: string, locale: 'he' | 'en', state?: FlowState | null) {
  const play = findConsultativeSalesPlay(input, locale);
  if (!play) return null;
  const saved = state?.pickupDate ? (locale === 'he' ? ` רשמתי כבר איסוף ${state.pickupDate}.` : ` I already have pickup ${state.pickupDate}.`) : '';
  return { play, reply: `${play.reflection}. ${play.response}${saved} ${play.nextAction}` };
}
