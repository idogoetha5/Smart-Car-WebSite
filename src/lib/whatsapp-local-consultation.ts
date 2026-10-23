/** Deterministic consultation: facts belong to the customer, not to fleet availability. */
export interface LocalConsultation {
  months?: number;
  annualKm?: number;
  budget?: number;
  budgetDeclined?: boolean;
  equipment: string[];
  awaiting?: 'annualKm' | 'budget' | 'equipment';
}

export function localConsultationTurn(text: string, previous?: LocalConsultation) {
  const annual = /(?:רכב|השכרה|ליסינג).{0,24}(?:לשנה|לשנתיים|12 חודשים)|(?:צריך|מחפש).{0,20}רכב לשנה/.test(text);
  if (!previous && !annual) return null;
  // Consultation memory survives an interruption; a policy question belongs to
  // the policy engine, not to the next unanswered sales slot.
  if (/[?？]|מה|איך|האם|אפשר/.test(text)
    && /פיקדון|השתתפות עצמית|ביטוח|דלק|עישון|שעות פתיחה|רישיון|נהג צעיר|כרטיס אשראי/.test(text)
    && !/הצעת מחיר|כמה (?:זה )?עולה|מה המחיר/.test(text)) return null;
  const state: LocalConsultation = { ...previous, equipment: [...(previous?.equipment ?? [])] };
  if (annual) state.months = /לשנתיים/.test(text) ? 24 : 12;
  const mileage = text.match(/(\d[\d, ]{2,7})\s*(?:ק[״"']?מ|קילומטר)/);
  const bare = /^\s*(\d[\d,]{2,6})\s*$/.exec(text);
  const value = Number((mileage?.[1] ?? bare?.[1] ?? '').replace(/[, ]/g, ''));
  if ((mileage || (bare && previous?.awaiting === 'annualKm')) && value >= 100 && value <= 200000) state.annualKm = value;
  if (bare && previous?.awaiting === 'budget' && value >= 100 && value <= 100000) state.budget = value;
  const budget = text.match(/(?:תקציב|עד)\s*(\d[\d,]*)\s*(?:שקל|ש[״"]ח|₪)?/);
  if (budget) state.budget = Number(budget[1].replace(/,/g, ''));
  if (/לא (?:רוצה|מעוניין|אגיד|אומר|צריך).{0,15}תקציב|אין (?:לי )?תקציב|בלי תקציב/.test(text)) state.budgetDeclined = true;
  for (const [pattern, label] of [[/גג (?:פתוח|נפתח)|סאנרוף/, 'גג נפתח'], [/קאר\s*פליי|קארפליי|carplay/i, 'Apple CarPlay'], [/(?:כיסאות|כסאות|מושבי|מושבים) עור/, 'מושבי עור']] as const) {
    if (!pattern.test(text)) continue;
    const negative = new RegExp(`(?:בלי|ללא|לא צריך|לא חייב|מוותר על)\\s*(?:\\S+\\s+){0,2}(?:${pattern.source})`, pattern.flags).test(text);
    state.equipment = state.equipment.filter(item => item !== label);
    if (!negative) state.equipment.push(label);
  }
  const summary = [state.months && `רכב ל־${state.months} חודשים`, state.annualKm && `${state.annualKm.toLocaleString('en-US')} ק״מ בשנה`, state.budget && `תקציב עד ${state.budget.toLocaleString('en-US')} ₪ לחודש`, ...state.equipment].filter(Boolean).join(', ');
  let reply: string;
  if (/שכחת|כבר (?:אמרתי|דיברנו|הסברתי)|(?:אמרתי|דיברנו|הסברתי)(?: לך)? כבר|מה (?:אמרתי|ביקשתי)|תזכיר|תסכם/.test(text)) {
    reply = `הפרטים שיש לי הם: ${summary}. נמשיך מכאן, אין צורך להתחיל מחדש.`;
  } else if (/הצעת מחיר|כמה (?:זה )?עולה|מה המחיר|תן מחיר/.test(text)) {
    reply = `לפי מה שסיכמנו: ${summary}. אין לי כרגע מחיר מאומת לתקופה ולאבזור האלה, ולכן לא אמציא סכום. אפשר להמשיך לדייק כאן את הבקשה לפני בדיקת הצעה.`;
  } else if (!state.annualKm) {
    state.awaiting = 'annualKm';
    reply = 'לשימוש ארוך כדאי להשוות השכרה ארוכה מול ליסינג לפי העלות הכוללת ותנאי היציאה, ולא רק התשלום החודשי. כמה ק״מ בערך אתה נוסע בשנה?';
  } else if (state.budgetDeclined && !state.budget) {
    state.awaiting = 'equipment';
    reply = `אפשר להתקדם בלי תקציב בשלב הזה. הפרטים שיש לי: ${summary}. לא אציג מחיר או זמינות בלי אימות.`;
  } else if (!state.budget) {
    state.awaiting = 'budget';
    reply = `${state.equipment.length ? `רשמתי כהעדפות: ${state.equipment.join(', ')} — זו עדיין לא הבטחה לאבזור ברכב מסוים. ` : `רשמתי ${state.annualKm.toLocaleString('en-US')} ק״מ בשנה. `}איזה תקציב חודשי נוח לך?`;
  } else {
    state.awaiting = 'equipment';
    reply = `הכיוון הוא ${summary}. בהשוואת ההצעות חשוב לבדוק גם מקדמה, ביטוח, טיפולים, חריגת ק״מ ויציאה מוקדמת; התנאים בפועל צריכים להופיע בהצעה. ${state.equipment.length ? 'איזו מהעדפות האבזור הכי חשובה לך?' : 'מה הכי חשוב לך ברכב עצמו?'}`;
  }
  return { state, reply };
}
