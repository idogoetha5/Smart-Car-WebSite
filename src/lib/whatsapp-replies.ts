/**
 * Human replies for when Gemini is not available (quota, outage) or a reply
 * must come from the app. Every situation has openers, cores and closers that
 * combine into thousands of distinct messages; a conversation never gets the
 * same sentence twice, and the choice is stable for the same conversation
 * moment (so tests and support reviews can reproduce it).
 */

import { BRAIN } from '@/lib/whatsapp-brain-data';
import { brainSituation } from '@/lib/whatsapp-brain';

export type Situation =
  | 'greeting' | 'greeting_again' | 'how_are_you' | 'doing_well' | 'thanks' | 'laugh' | 'ack'
  | 'compliment' | 'angry' | 'sorry' | 'off_topic' | 'bye' | 'price_objection' | 'discount'
  | 'thinking' | 'unsure' | 'confused' | 'waiting' | 'unknown'
  | 'doing_badly' | 'yes' | 'no' | 'maybe' | 'complaint_waiting' | 'frustration_repeat' | 'wait' | 'later'
  | 'urgent' | 'human_request' | 'bot_question' | 'trust_doubt' | 'wrong_number' | 'test_message' | 'insult' | 'love_emoji_only' | 'bot_name' | 'about_us';

export type BookingAsk = 'pickup_date' | 'return_date' | 'places' | 'pickup_place' | 'return_place' | 'vehicle' | 'name' | 'email';

type Parts = { open?: string[]; core: string[]; close?: string[] };
type Locale = 'he' | 'en';

const HE_BASE: Partial<Record<Situation, Parts>> = {
  greeting: {
    open: ['היי!', 'היי 👋', 'אהלן!', 'שלום שלום!', 'היי, כאן SmartCar 👋', 'אהלן, כאן SmartCar', 'הי!', 'שלום!'],
    core: ['מה אפשר לסדר לך היום?', 'במה אני יכול לעזור?', 'ספר לי מה צריך 🙂', 'איך אפשר לעזור?', 'מה מחפשים?', 'מה מתוכנן?', 'מחפש רכב, או שיש שאלה?', 'אני פה לכל שאלה — רכב, ליסינג, מה שצריך.'],
  },
  greeting_again: {
    open: ['שוב היי 🙂', 'היי היי', 'אהלן שוב', 'הנה אני', 'כן?', 'היי'],
    core: ['מה עוד אפשר לעשות בשבילך?', 'ממשיכים מאיפה שעצרנו?', 'ספר לי.', 'אני איתך.', 'במה עוד אפשר לעזור?', 'מה קורה?'],
  },
  how_are_you: {
    open: ['הכל טוב, תודה ששאלת 🙂', 'מצוין, תודה!', 'אחלה, ברוך השם', 'טוב מאוד, תודה', 'הכל סבבה 🙂', 'מעולה, יום עמוס אבל כיף', 'הכל טוב פה', 'סבבה לגמרי, תודה', 'אחלה יום, תודה', 'מעולה 🙂'],
    core: ['איתך?', 'מה איתך?', 'ואצלך?', 'איך אצלך?', 'מה שלומך?', 'מה נשמע אצלך?', 'ומה אצלך?', 'ואיך אתה?'],
  },
  doing_well: {
    open: ['אחלה,', 'יופי,', 'שמח לשמוע,', 'איזה כיף,', 'מעולה,', 'טוב לשמוע,', 'ככה אני אוהב,', 'אש,', 'יאללה יופי,'],
    core: ['מה מתוכנן?', 'יש משהו שאפשר לעזור בו?', 'אם צריך רכב או שאלה — אני פה.', 'ספר לי במה אפשר לעזור.', 'יוצאים לאנשהו בקרוב?', 'מה אפשר לסדר לך?', 'יש נסיעה באופק?', 'במה אני יכול לעזור היום?', 'מה מביא אותך אלינו?'],
  },
  thanks: {
    open: ['בכיף!', 'בשמחה!', 'אין על מה 🙂', 'תמיד!', 'בכיף גדול', 'בשמחה רבה', 'על לא דבר!', 'בכיף 🙏'],
    core: ['', '', 'אם צריך עוד משהו — אני פה.', 'שיהיה יום מעולה!', 'נדבר 🙂', 'כל שאלה — פשוט תכתוב.', 'שתהיה נסיעה טובה!', 'תמיד שמח לעזור.', 'בשביל זה אני פה.', 'שיהיה בהצלחה!', 'אם עולה עוד משהו, תכתוב בלי להתבייש.'],
  },
  laugh: {
    open: ['חחח', '😄', 'חח', 'הא הא', '😂'],
    core: ['אהבתי', 'טוב נו', 'סבבה לגמרי', 'הצחקת אותי', 'גם אני ככה', 'יש לך הומור'],
    close: ['', '', 'אז מה אצלך?', 'במה עוד אפשר לעזור?'],
  },
  ack: {
    open: ['סבבה', 'סגור', 'אחלה', 'יופי', 'מעולה', 'אוקיי', 'בסדר גמור', 'מצוין', 'קיבלתי', 'רשום אצלי'],
    core: ['👍', '🙂', '', '', '👌', '🙌'],
  },
  compliment: {
    open: ['תודה רבה!', 'וואו, תודה 🙏', 'איזה כיף לשמוע', 'משמח מאוד', 'תודה, זה עושה לי את היום'],
    core: ['אנחנו משתדלים בשביל זה.', 'אני אעביר את זה לצוות 🙂', 'בשביל זה אנחנו פה.', 'נמשיך ככה.', ''],
  },
  angry: {
    open: ['אוי, ממש לא נעים לשמוע.', 'מבין אותך לגמרי, ומצטער שזה קרה.', 'סליחה על זה, באמת.', 'אני שומע אותך, ואתה צודק שזה מתסכל.', 'ממש מצטער על החוויה.'],
    core: ['ספר לי בבקשה מה בדיוק קרה, ואני דואג שזה יגיע עכשיו לצוות.', 'תכתוב לי את הפרטים ואני מעביר את זה מיד למי שמטפל.', 'אם יש מספר הזמנה — תשלח אותו פה, ואני מעביר את זה לצוות עכשיו.', 'אני רוצה לסדר את זה — מה הפרטים?'],
  },
  sorry: {
    open: ['הכל טוב 🙂', 'אין בעיה בכלל', 'לגמרי בסדר', 'אל דאגה'],
    core: ['ממשיכים.', 'קורה לכולם.', 'במה אפשר לעזור?', 'בוא נמשיך.'],
  },
  off_topic: {
    open: ['האמת שבזה אני חלש 😅', 'שאלה טובה, אבל זה פחות התחום שלי', 'וואלה, על זה אני לא הכי מבין', 'פה אני פחות מומחה 😄', 'זה קצת מחוץ למגרש שלי'],
    core: ['ברכבים — זה כבר סיפור אחר.', 'אבל אם צריך רכב, אני על זה.', 'בהשכרת רכב ובליסינג — שם אני חזק.', 'רכב לתאריכים מסוימים? את זה אני יודע לסדר.', 'אם יש שאלה על רכבים — יאללה.', 'אבל אם יוצאים לטיול, רכב אני יכול לסדר 😉', 'על רכבים, לעומת זאת, אני יכול לדבר שעות.'],
    close: ['', '', 'מה מתוכנן אצלך?'],
  },
  bye: {
    open: ['ביי!', 'יאללה ביי 👋', 'להתראות!', 'נדבר!', 'שיהיה המשך יום טוב!', 'סבבה, ביי', 'יאללה, שיהיה בהצלחה', 'ביי ביי 🙂'],
    core: ['', 'אם צריך משהו — אני כאן.', 'שמח לעזור.', 'סע בזהירות 🙂', 'תמיד אפשר לחזור לפה.', 'הפרטים שמורים אצלי אם תחזור.', 'היה כיף לדבר.'],
  },
  price_objection: {
    open: ['מבין אותך, מחיר זה חשוב.', 'הוגן לגמרי לבדוק מחירים.', 'לגמרי מבין.', 'שאלה של מחיר זה תמיד עניין.', 'צודק שכדאי להשוות.'],
    core: ['תגיד לי לאיזה תאריכים, ואני אבדוק מה הכי משתלם אצלנו.', 'בוא נראה מה יוצא לתאריכים שלך — לפעמים זה מפתיע לטובה.', 'אם תכתוב תאריכים וסוג רכב, אראה לך אפשרויות במחירים הכי טובים שיש לנו.', 'שלח תאריכים ונמצא משהו שמתאים גם לכיס.'],
  },
  discount: {
    open: ['הנחה אני לא יכול להבטיח מפה,', 'בעניין הנחה —', 'מבין לגמרי שמחפשים מחיר טוב,'],
    core: ['אבל נציג בודק את המחיר הכי טוב לתאריכים שלך. לאיזה תאריכים?', 'מי שמטפל בבקשה בודק את המחיר הכי טוב שאפשר. מה התאריכים?', 'תגיד תאריכים ואני מעביר את הבקשה עם בקשה למחיר הכי טוב.'],
  },
  thinking: {
    open: ['בטח, אין לחץ.', 'לגמרי, תחשוב בנחת.', 'סבבה, קח את הזמן.', 'אין בעיה בכלל.'],
    core: ['כשתחליט — פשוט תכתוב פה ונמשיך מאיפה שעצרנו.', 'הפרטים שמורים אצלי, אפשר לחזור מתי שנוח.', 'אם עולה שאלה בינתיים — אני פה.', ''],
  },
  unsure: {
    open: ['אין בעיה, בשביל זה אני פה.', 'סבבה, בוא נחשוב ביחד.', 'לגמרי, נעזור לבחור.'],
    core: ['כמה אתם בערך, ויש הרבה מזוודות?', 'לאן נוסעים ולכמה זמן? ככה אכוון אותך.', 'מה הכי חשוב לך — חיסכון, מקום או נוחות?'],
  },
  confused: {
    open: ['רגע, לא בטוח שהבנתי 🙂', 'סליחה, לא לגמרי תפסתי', 'אפשר לחדד רגע?', 'לא הבנתי עד הסוף'],
    core: ['תכתוב לי במילים אחרות?', 'למה התכוונת?', 'אפשר עוד קצת פרטים?', 'זה לגבי השכרה, ליסינג או משהו אחר?'],
  },
  about_us: {
    open: ['בקצרה:', 'בשמחה 🙂', 'אז ככה —'],
    core: ['אנחנו SmartCar — השכרת רכב לטווח קצר וארוך, ליסינג ורכבים למכירה. יש לנו סניפים בהרצליה, תל אביב, ירושלים ונתב״ג, ואפשר גם להביא את הרכב עד אליך.', 'SmartCar משכירה רכבים — מרכב קטן לעיר ועד 7 מקומות ויוקרה — ויש גם ליסינג ורכבים למכירה. סניפים בהרצליה, תל אביב, ירושלים ונתב״ג.'],
    close: ['מחפש רכב לתאריכים מסוימים?', 'יש משהו שאני יכול לבדוק בשבילך?'],
  },
  bot_name: {
    open: ['נעים מאוד 🙂', 'שאלה יפה 😊', 'אין לי שם רשמי,'],
    core: ['אני העוזר הדיגיטלי של SmartCar — אפשר לקרוא לי פשוט "העוזר של סמארט".', 'אני הנציג הדיגיטלי של SmartCar, ואני פה בשבילך.', 'קוראים לי העוזר של SmartCar. ואיך קוראים לך?'],
    close: ['', 'במה אפשר לעזור?'],
  },
  bot_question: {
    open: ['כן 🙂', 'תפסת אותי 😄', 'נכון,', 'האמת? כן 🙂'],
    core: ['אני העוזר הדיגיטלי של SmartCar, ואני כאן לכל שאלה ובקשה.', 'עונה על שאלות ומסדר בקשות השכרה, ואם תעדיף בן אדם — תכתוב "נציג".', 'אני דיגיטלי, אבל הצוות שלנו מאוד אנושי ומאשר כל הזמנה.'],
    close: ['', 'במה אפשר לעזור?'],
  },
  waiting: {
    open: ['סליחה על ההמתנה 🙏', 'מצטער שזה לוקח זמן.', 'אני על זה.'],
    core: ['העברתי את זה לצוות, מישהו חוזר אליך בהקדם.', 'הבקשה אצל הצוות, הם יחזרו אליך.', 'זה כבר אצל מי שמטפל — הוא חוזר אליך.'],
  },
  unknown: {
    open: ['אני פה 🙂', 'בטח —', 'הבנתי.', 'אוקיי,', 'סבבה,'],
    core: ['ספר לי מה צריך — רכב להשכרה, שאלה על משהו, ליסינג?', 'במה אני יכול לעזור? רכב לתאריכים מסוימים, או שאלה?', 'מה הכי יעזור לך עכשיו — לבדוק רכב לתאריכים שלך, או משהו אחר?', 'תכתוב לי במה מדובר ואני על זה.'],
  },
};

const EN_BASE: Partial<Record<Situation, Parts>> = {
  greeting: {
    open: ['Hi!', 'Hey 👋', 'Hello!', 'Hi there!', 'Hey, SmartCar here 👋', 'Hello, this is SmartCar'],
    core: ['What can I sort out for you today?', 'How can I help?', 'Tell me what you need 🙂', 'Looking for a car, or got a question?', 'What are you planning?'],
  },
  greeting_again: {
    open: ['Hey again 🙂', 'Hi hi', 'Back again!', 'Here I am'],
    core: ['What else can I do for you?', 'Shall we pick up where we left off?', 'Go ahead.', 'I’m with you.'],
  },
  how_are_you: {
    open: ['All good, thanks for asking 🙂', 'Great, thanks!', 'Doing well, thanks', 'Pretty good 🙂'],
    core: ['You?', 'How about you?', 'And you?', 'How are things with you?'],
  },
  doing_well: {
    open: ['Nice,', 'Great to hear,', 'Glad to hear it,', 'Awesome,'],
    core: ['what are you planning?', 'anything I can help with?', 'if you need a car or have a question, I’m here.', 'heading somewhere soon?'],
  },
  thanks: {
    open: ['You’re welcome!', 'Anytime!', 'My pleasure 🙂', 'No problem!', 'Happy to help!'],
    core: ['', '', 'If you need anything else, I’m here.', 'Have a great day!', 'Safe travels!'],
  },
  laugh: {
    open: ['Haha', '😄', 'Ha!', '😂'],
    core: ['love it', 'fair enough', 'you made me smile', 'same here'],
    close: ['', '', 'So what’s up?', 'Anything I can help with?'],
  },
  ack: { open: ['Sure', 'Got it', 'Great', 'Perfect', 'OK', 'Sounds good', 'Cool'], core: ['👍', '🙂', '', ''] },
  compliment: {
    open: ['Thank you!', 'Wow, thanks 🙏', 'That’s great to hear', 'That made my day'],
    core: ['That’s what we’re here for.', 'I’ll pass it on to the team 🙂', ''],
  },
  angry: {
    open: ['I’m really sorry to hear that.', 'I completely understand, and I’m sorry this happened.', 'Sorry about that, truly.', 'I hear you — that’s frustrating.'],
    core: ['Tell me what happened and I’ll get it to the team right now.', 'Send me the details and I’ll pass them straight on.', 'If you have a booking number, send it here and I’ll escalate it now.'],
  },
  sorry: { open: ['No worries 🙂', 'All good', 'Not a problem at all'], core: ['Let’s keep going.', 'Happens to everyone.', 'How can I help?'] },
  off_topic: {
    open: ['Honestly, that’s not my strong suit 😅', 'Good question, but that’s outside my lane', 'I’m not the best one to ask about that 😄'],
    core: ['Cars, on the other hand — that I can do.', 'But if you need a car, I’m on it.', 'Car rental and leasing — that’s where I shine.'],
  },
  bye: { open: ['Bye!', 'Take care 👋', 'Talk soon!', 'Have a great day!'], core: ['', 'If you need anything, I’m here.', 'Drive safe 🙂'] },
  price_objection: {
    open: ['I get it, price matters.', 'Totally fair to compare.', 'Makes sense to shop around.'],
    core: ['Tell me your dates and I’ll show you the best value we have.', 'Send me your dates and car type and I’ll find the best price we can do.'],
  },
  discount: {
    open: ['I can’t promise a discount from here,', 'About a discount —'],
    core: ['but the representative checks the best price for your dates. Which dates?', 'send me your dates and I’ll pass the request on asking for the best price.'],
  },
  thinking: {
    open: ['Sure, no pressure.', 'Of course, take your time.', 'No problem at all.'],
    core: ['When you’re ready, just write here and we’ll pick up where we left off.', 'Your details are saved, come back whenever.', ''],
  },
  unsure: {
    open: ['No problem, that’s what I’m here for.', 'Sure, let’s figure it out together.'],
    core: ['How many of you are there, and how much luggage?', 'Where are you heading and for how long?', 'What matters most — saving money, space or comfort?'],
  },
  confused: {
    open: ['Sorry, not sure I got that 🙂', 'Hmm, I didn’t quite catch that', 'Could you clarify?'],
    core: ['Could you put it another way?', 'What did you mean?', 'Is it about a rental, leasing or something else?'],
  },
  about_us: {
    open: ['In short:', 'Happy to 🙂'],
    core: ['We’re SmartCar — short and long-term car rental, leasing and cars for sale, with branches in Herzliya, Tel Aviv, Jerusalem and Ben Gurion Airport, and delivery to you is possible too.', 'SmartCar rents cars — from small city cars to 7-seaters and luxury — and also offers leasing and cars for sale.'],
    close: ['Looking for a car for some dates?', 'Anything I can check for you?'],
  },
  bot_name: {
    open: ['Nice to meet you 🙂', 'Good question 😊', 'I don’t have an official name,'],
    core: ['I’m SmartCar’s digital assistant — you can just call me "the SmartCar assistant".', 'I’m SmartCar’s digital assistant, and I’m here for you.', 'I’m the SmartCar assistant. And what’s your name?'],
    close: ['', 'How can I help?'],
  },
  bot_question: {
    open: ['Yes 🙂', 'You got me 😄', 'I’m SmartCar’s digital assistant —'],
    core: ['I answer questions and set up rental requests, and if you’d rather talk to a person, just write "representative".', 'I’m digital, but our team is very human and confirms every booking.'],
    close: ['', 'How can I help?'],
  },
  waiting: {
    open: ['Sorry for the wait 🙏', 'Sorry this is taking a while.', 'I’m on it.'],
    core: ['I’ve passed it to the team and someone will get back to you shortly.', 'It’s with the team now — they’ll get back to you.'],
  },
  unknown: {
    open: ['I’m here 🙂', 'Sure —', 'Got it.', 'OK,'],
    core: ['tell me what you need — a rental, a question, leasing?', 'how can I help? A car for some dates, or a question?', 'what would help most right now?'],
  },
};

/** Hand-written lines plus the brain's reply lists (scripts/whatsapp-eval/lexicon/brain/replies.json). */
function merged(base: Partial<Record<Situation, Parts>>, locale: Locale): Record<string, Parts> {
  const out: Record<string, Parts> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(BRAIN.replies)]);
  for (const key of keys) {
    const mine = base[key as Situation];
    const theirs = BRAIN.replies[key]?.[locale];
    const list = (a?: string[], b?: string[]) => [...new Set([...(a ?? []), ...(b ?? [])])];
    const core = list(mine?.core, theirs?.core).filter((line) => line !== '' || !mine);
    if (!core.length) continue;
    out[key] = { open: list(mine?.open, theirs?.open), core: core.length ? core : [''], close: list(mine?.close, theirs?.close) };
    if (!out[key].open?.length) delete out[key].open;
    if (!out[key].close?.length) delete out[key].close;
  }
  return out;
}
const HE = merged(HE_BASE, 'he');
const EN = merged(EN_BASE, 'en');

const ASKS_HE: Record<BookingAsk, string[]> = {
  pickup_date: ['מאיזה תאריך צריך את הרכב?', 'מתי בא לך לאסוף?', 'לאיזה תאריך מתכננים?', 'מתי מתחילים?', 'מאיזה יום צריך אותו?', 'מתי בערך תרצה לאסוף את הרכב?'],
  return_date: ['ועד מתי צריך את הרכב (או לכמה ימים)?', 'לכמה ימים בערך?', 'ומתי מחזירים?', 'עד איזה תאריך?', 'כמה ימים תצטרך אותו?'],
  places: ['ומאיפה נוח לך לאסוף ולאן להחזיר?', 'איפה אוספים ואיפה מחזירים? סניף או כתובת — שניהם עובדים.', 'מאיזה סניף נוח לך — הרצליה, תל אביב, ירושלים או נתב״ג? או שנביא עד אליך?', 'מאיפה לאסוף, ולאן להחזיר?'],
  pickup_place: ['ומאיפה נוח לך לאסוף?', 'מאיזה מקום אוספים?', 'איפה הכי נוח לאסוף את הרכב?'],
  return_place: ['להחזיר לאותו מקום או למקום אחר?', 'ולאן מחזירים?', 'ההחזרה באותו מקום?', 'איפה נוח לך להחזיר?'],
  vehicle: ['איזה רכב מתאים לכם — קטן וחסכוני, משפחתי, SUV, 7 מקומות או יוקרה?', 'כמה אתם, ויש מזוודות? ככה אכוון אותך לרכב הנכון.', 'מה סוג הרכב שמתאים — משהו קטן, משפחתי, או יותר גדול?', 'יש סוג רכב שבא לך?'],
  name: ['על איזה שם לרשום את הבקשה?', 'מה השם המלא לבקשה?', 'על שם מי רושמים?', 'איך קוראים לך (שם מלא)?'],
  email: ['לאיזה מייל לשלוח את הסיכום?', 'מה המייל שלך? אשלח לשם את הסיכום.', 'ולאיזו כתובת מייל לשלוח את הפרטים?'],
};

const ASKS_EN: Record<BookingAsk, string[]> = {
  pickup_date: ['From which date do you need the car?', 'When would you like to pick it up?', 'What date are you planning for?', 'When do you start?'],
  return_date: ['And until when (or for how many days)?', 'How many days roughly?', 'When are you bringing it back?', 'Until which date?'],
  places: ['Where would you like to pick it up and drop it off?', 'Pickup and return — a branch or an address, both work.', 'Which branch suits you — Herzliya, Tel Aviv, Jerusalem or Ben Gurion Airport? Or shall we bring it to you?'],
  pickup_place: ['And where would you like to pick it up?', 'Where’s best for the pickup?'],
  return_place: ['Returning it to the same place, or somewhere else?', 'And where will you drop it off?'],
  vehicle: ['What kind of car suits you — small, family, SUV, 7 seats or luxury?', 'How many of you are there, and any luggage? I’ll match the right car.', 'Any car type in mind?'],
  name: ['What full name should I put the request under?', 'What’s the full name for the request?'],
  email: ['Which email should I send the summary to?', 'What’s your email? I’ll send the summary there.'],
};

/** A stable pseudo-random number for this moment of the conversation. */
function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function pick<T>(list: readonly T[], seed: number, skip: (value: T) => boolean = () => false): T {
  for (let i = 0; i < list.length; i += 1) {
    const value = list[(seed + i) % list.length];
    if (!skip(value)) return value;
  }
  return list[seed % list.length];
}

const LAUGH = /^(?:ח{2,}|הא הא|haha|ha!?)$/i;
/** Joins parts as sentences: "זה קצת מחוץ למגרש שלי. אם יש שאלה…" (laughs and emojis need no full stop). */
const join = (...parts: string[]) => parts.map((part) => part.trim()).filter(Boolean).reduce((text, part) => {
  if (!text) return part;
  const needsStop = /[\p{L}\p{N}]$/u.test(text) && !LAUGH.test(text) && !/,$/.test(text);
  return `${text}${needsStop ? '.' : ''} ${part}`;
}, '').replace(/\s+([,.!?])/g, '$1');

/** A person texting rarely sends two emojis in one line: keep the first. */
function oneEmoji(line: string) {
  let seen = false;
  return line.replace(/\p{Extended_Pictographic}\uFE0F?/gu, (emoji) => {
    if (seen) return '';
    seen = true;
    return emoji;
  }).replace(/\s{2,}/g, ' ').trim();
}

/** One human line for a situation, never one of `used` (the bot's earlier messages). */
function overlaps(a: string, b: string) {
  const words = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2);
  const first = words(a);
  const second = new Set(words(b));
  return first.length >= 2 && first.filter((w) => second.has(w)).length >= Math.ceil(first.length * 0.6);
}

export function humanLine(situation: Situation, locale: Locale, seed: string, used: readonly string[] = []): string {
  const parts = (locale === 'en' ? EN : HE)[situation] ?? (locale === 'en' ? EN : HE).unknown;
  const base = hash(`${seed}:${situation}`);
  const usedText = used.join('\n');
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const open = parts.open ? pick(parts.open, base + attempt * 7) : '';
    const core = pick(parts.core, base >>> 3 ^ attempt * 13);
    const close = parts.close ? pick(parts.close, base >>> 5 ^ attempt * 3) : '';
    // "אני העוזר… — אני העוזר…": an opening that the core repeats is dropped.
    if (open && overlaps(open, core)) continue;
    // One question at most, and no pile of exclamations: "בכיף! שתהיה נסיעה טובה! שיהיה המשך יום מעולה!".
    const sentences = (text: string) => (text.match(/[.!?？]/g) ?? []).length;
    const keepClose = close && !/[?？]\s*\p{Extended_Pictographic}*\s*$/u.test(core) && sentences(join(open, core)) < 2;
    const line = oneEmoji(join(open, core, keepClose ? close : ''));
    if (line && !usedText.includes(line)) return line;
  }
  return join(pick(parts.open ?? [''], base), pick(parts.core, base + 1));
}

/** The booking question in a wording the conversation has not used yet. */
export function bookingQuestion(ask: BookingAsk, locale: Locale, seed: string, used: readonly string[] = []): string {
  const list = (locale === 'en' ? ASKS_EN : ASKS_HE)[ask];
  const usedText = used.join('\n');
  return pick(list, hash(`${seed}:${ask}`), (q) => usedText.includes(q));
}

/** How many different messages the library can produce: lines alone, and lines followed by a booking question. */
export function variety() {
  let lines = 0;
  let withQuestion = 0;
  for (const [table, asks] of [[HE, ASKS_HE], [EN, ASKS_EN]] as const) {
    const questions = Object.values(asks).reduce((sum, list) => sum + list.length, 0);
    for (const parts of Object.values(table)) {
      const count = (parts.open?.length ?? 1) * parts.core.length * (parts.close?.length ?? 1);
      lines += count;
      withQuestion += count * questions;
    }
  }
  return { lines, withQuestion };
}

/** Recognises small talk and everyday remarks without Gemini. */
/** Recognises small talk and everyday remarks without Gemini: precise rules first, then the brain's 20,000 phrases. */
export function detectSituation(text: string): Situation | null {
  return detectByRules(text) ?? brainSituation(text);
}

function detectByRules(text: string): Situation | null {
  const t = text.trim().toLowerCase().replace(/[!.,]+$/g, '');
  if (!t) return null;
  if (/(?:איך|מה) (?:קוראים לך|השם שלך|שמך)|מי (?:אתה|את)\b|what(?:'?s| is) your name|who are you/.test(t)) return 'bot_name';
  if (/מה (?:אתם|את|אתה) (?:בעצם )?(?:עושים|עושה|מציעים)|מה זה (?:smartcar|סמארט ?קאר)|מי אתם|במה אתם עוסקים|what do you (?:guys )?do|who are you guys|what is smartcar/.test(t)) return 'about_us';
  if (/^(?:ביי|ביי ביי|להתראות|יאללה ביי|לילה טוב|bye|goodbye|see you|good night|cya)\b/.test(t)) return 'bye';
  if (/(?:^|\s)(?:תודה|תודות|thanks|thank you|thx|tnx|תנקס)(?:\s|$)/.test(t) && t.length < 40) return 'thanks';
  if (/^(?:ח{2,}|הה+|😂|🤣|😄|😅|lol|haha+|lmao)/.test(t)) return 'laugh';
  if (/^(?:מה קורה|מה נשמע|מה המצב|מה איתך|מה שלומך|מה העניינים|how are you|how r u|what'?s up|sup|wassup)\??$/.test(t)) return 'how_are_you';
  if (/^(?:היי+|הי|שלום|אהלן|הלו|בוקר טוב|ערב טוב|צהריים טובים|hi+|hello|hey+|yo|good morning|good evening)(?:\s|$)/.test(t) && t.length < 25) return 'greeting';
  if (/(?:אתם|אתה) (?:תותחים|אלופים|מעולים|הכי טובים|גדולים)|שירות מעולה|you(?:'re| are) (?:great|awesome|the best)|great service/.test(t)) return 'compliment';
  if (/(?:יקר|יקרים|מחיר מטורף|זול יותר|יותר זול|באלדן|בשלמה|בהרץ|too expensive|expensive|cheaper)/.test(t) && !/הנחה|discount/.test(t)) return 'price_objection';
  if (/הנחה|מבצע|discount|deal|promo/.test(t)) return 'discount';
  if (/(?:אחשוב|אני אחשוב|נחשוב|אבדוק ואחזור|אחזור אליך|i'?ll think|let me think|get back to you)/.test(t)) return 'thinking';
  if (/(?:לא יודע|לא בטוח|לא בטוחה|אין לי מושג|not sure|no idea|dunno)/.test(t)) return 'unsure';
  if (/^(?:הכל טוב|טוב|בסדר|מצוין|מעולה|ברוך השם|ב״ה|בה|all good|good|fine|great)(?:\s|$|,)/.test(t) && t.split(/\s+/).length <= 4) return 'doing_well';
  if (/(?:סליחה|sorry|my bad)/.test(t) && t.length < 30) return 'sorry';
  if (/(?:מזג האוויר|מזג אוויר|כדורגל|מכבי|הפועל|מתכון|בדיחה|weather|football|soccer|recipe|joke)/.test(t)) return 'off_topic';
  if (/^(?:סבבה|סגור|אחלה|יופי|אוקי+|אוקיי|בסדר|ok+|okay|cool|nice|sure|👍|👌|🙏)$/.test(t)) return 'ack';
  return null;
}
