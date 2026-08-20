import type { CarForSale } from '@/lib/cars-for-sale';

export type CarSalesAction =
  | 'purchase_start' | 'catalog' | 'budget' | 'compare' | 'family_luggage'
  | 'city_highway' | 'verified_drive' | 'year' | 'mileage' | 'color_extras'
  | 'trust' | 'too_expensive' | 'thinking' | 'competitor' | 'discount'
  | 'viewing' | 'finance' | 'trade_in' | 'history' | 'warranty'
  | 'mechanical' | 'test_drive' | 'delivery' | 'vehicle_selected' | 'no_match';

export type CarSalesContext = {
  mode: 'car_sale';
  lastAction?: CarSalesAction;
  selectedCarIds?: string[];
  budget?: number;
  needs?: string[];
};

export type CarSalesReply = {
  reply: string;
  action: CarSalesAction;
  context: CarSalesContext;
  escalate?: boolean;
  escalateReason?: string;
};

export type CommercialIntent = 'rental' | 'leasing' | 'car_sale' | 'sell_own_car' | 'ambiguous' | 'none';

type Locale = 'he' | 'en';

function normal(input: string) {
  return input.trim().toLowerCase().replace(/[״"']/g, '').replace(/\s+/g, ' ');
}

function has(text: string, expression: RegExp) {
  return expression.test(text);
}

/**
 * This classifier intentionally distinguishes a customer buying a listed car
 * from a new rental, leasing enquiry, and a person trying to sell their own
 * car. A bare “car” is never silently placed into one of those funnels.
 */
export function classifyCommercialIntent(input: string): CommercialIntent {
  const text = normal(input);
  if (has(text, /למכור (?:את )?(?:הרכב|האוטו) (?:שלי|שלנו)|מכירת הרכב שלי|sell (?:my|our) (?:car|vehicle)|trade in my car/)) return 'sell_own_car';
  if (has(text, /ליסינג|lease(?: a)? car|private leasing|business leasing/)) return 'leasing';
  if (has(text, /לקנות|קני(?:ה|ית) רכב|רכב למכירה|מכירת רכב|רכישה|buy (?:a|the) (?:car|vehicle)|purchase (?:a|the)? ?(?:car|vehicle)|cars? for sale|used car/)) return 'car_sale';
  if (has(text, /השכר|להשכיר|rent(?:al)?|hire (?:a )?car|book (?:a )?car/)) return 'rental';
  if (has(text, /צריך (?:רכב|אוטו)|מחפש (?:רכב|אוטו)|need (?:a )?(?:car|vehicle)|looking for (?:a )?(?:car|vehicle)/)) return 'rental';
  if (has(text, /(?:^|\s)(?:רכב|אוטו|car|vehicle|auto)(?:\s|$)/)) return 'ambiguous';
  return 'none';
}

export function isCarSaleConversation(input: string, context?: CarSalesContext) {
  return context?.mode === 'car_sale' || classifyCommercialIntent(input) === 'car_sale';
}

export function commercialIntentQuestion(locale: Locale) {
  return locale === 'he'
    ? 'בשמחה. כדי לכוון נכון: מחפשים השכרה, ליסינג, רכב שמופיע למכירה, או רוצים למכור רכב בבעלותכם?'
    : 'Happy to help. To point you correctly: are you looking to rent, lease, buy a listed car, or sell a car you own?';
}

export function ownCarSaleHandoff(locale: Locale) {
  return locale === 'he'
    ? 'הבנתי שתרצו למכור רכב בבעלותכם. אין לי מסלול מאומת לקליטת רכב פרטי, לכן אעביר לנציג שיבדוק אם השירות זמין ומה נדרש.'
    : 'I understand you would like to sell a car you own. I do not have a verified private-vehicle intake path, so I will pass this to a representative to check whether the service is available and what is needed.';
}

function currency(value: number, locale: Locale) {
  return locale === 'he' ? `₪${value.toLocaleString('he-IL')}` : `₪${value.toLocaleString('en-US')}`;
}

function carName(car: CarForSale) {
  return `${car.make} ${car.model}`.trim();
}

function carLine(car: CarForSale, locale: Locale, number?: number) {
  const prefix = number ? `${number}. ` : '';
  const km = car.km === null ? null : (locale === 'he' ? `${car.km.toLocaleString('he-IL')} ק״מ` : `${car.km.toLocaleString('en-US')} km`);
  const color = car.color ? (locale === 'he' ? `צבע: ${car.color}` : `colour: ${car.color}`) : null;
  return `${prefix}${carName(car)} · ${car.year} · ${currency(car.price, locale)}${km ? ` · ${km}` : ''}${color ? ` · ${color}` : ''}`;
}

function carDetails(car: CarForSale, locale: Locale) {
  const details = [
    `${carName(car)} · ${car.year}`,
    locale === 'he' ? `מחיר שמופיע בקטלוג: ${currency(car.price, locale)}` : `Listed price: ${currency(car.price, locale)}`,
    car.km === null ? null : (locale === 'he' ? `קילומטראז׳ שמופיע בקטלוג: ${car.km.toLocaleString('he-IL')} ק״מ` : `Listed mileage: ${car.km.toLocaleString('en-US')} km`),
    car.color ? (locale === 'he' ? `צבע: ${car.color}` : `Colour: ${car.color}`) : null,
    car.extras ? (locale === 'he' ? `תוספות שמופיעות בקטלוג: ${car.extras}` : `Listed extras: ${car.extras}`) : null,
    car.image_url ? (locale === 'he' ? 'במודעה קיימת תמונה.' : 'The listing includes an image.') : null,
  ].filter(Boolean);
  return details.join('\n');
}

function findMentionedCars(input: string, cars: CarForSale[]) {
  const text = normal(input);
  return cars.filter((car) => {
    const name = normal(carName(car));
    const model = normal(car.model);
    return (name.length >= 3 && text.includes(name)) || (model.length >= 3 && text.includes(model));
  });
}

function numberFromBudget(input: string) {
  const text = normal(input).replace(/[₪,$]/g, '');
  const match = text.match(/(?:עד|budget|under|below|max(?:imum)?|around|בערך)\s*(\d{2,7})(?:\s*(?:אלף|k|thousand))?/i)
    ?? text.match(/(\d{2,7})\s*(?:שח|nis|ils|₪)/i);
  if (!match) return undefined;
  const multiplier = /אלף|k|thousand/i.test(match[0]) ? 1000 : 1;
  const value = Number(match[1]) * multiplier;
  return Number.isFinite(value) && value >= 1_000 && value <= 10_000_000 ? value : undefined;
}

function withNeed(context: CarSalesContext, need: string, action: CarSalesAction): CarSalesContext {
  return { ...context, mode: 'car_sale', lastAction: action, needs: [...new Set([...(context.needs ?? []), need])] };
}

function agentReply(locale: Locale, action: CarSalesAction, context: CarSalesContext, subject: string): CarSalesReply {
  const contextWithAction = { ...context, mode: 'car_sale' as const, lastAction: action };
  const known = context.selectedCarIds?.length ? (locale === 'he' ? 'רשמתי גם את הרכב/ים שבחרת.' : 'I have also kept the selected vehicle(s).') : '';
  const reply = locale === 'he'
    ? `${subject} זה פרט שלא מופיע בנתוני הקטלוג המאומתים, ולכן לא אנחש. העברתי לנציג עם ההקשר שכבר שיתפת. ${known}`.trim()
    : `${subject} is not in the verified catalogue data, so I will not guess. I have passed this to a representative with the context you already shared. ${known}`.trim();
  return { reply, action, context: contextWithAction, escalate: true, escalateReason: `מכירת רכב: ${action}${context.selectedCarIds?.length ? ` | רכבים: ${context.selectedCarIds.join(', ')}` : ''}` };
}

function catalogueReply(cars: CarForSale[], locale: Locale, context: CarSalesContext, action: CarSalesAction = 'catalog'): CarSalesReply {
  const nextContext = { ...context, mode: 'car_sale' as const, lastAction: action };
  if (!cars.length) {
    return {
      action: 'no_match', context: { ...nextContext, lastAction: 'no_match' }, escalate: true,
      escalateReason: 'מכירת רכב: אין רכבים בקטלוג המאומת',
      reply: locale === 'he'
        ? 'אין כרגע רכבים בנתוני הקטלוג המאומתים שאני יכול להציג. אעביר לנציג את סוג הרכב שאתם מחפשים, בלי להבטיח זמינות.'
        : 'There are no vehicles in the verified catalogue data that I can show right now. I will pass the type of vehicle you are seeking to a representative, without promising availability.',
    };
  }
  const shown = cars.slice(0, 3);
  return {
    action, context: nextContext,
    reply: locale === 'he'
      ? `הנה רכבים שמופיעים בקטלוג המכירה המאומת:\n${shown.map((car, index) => carLine(car, locale, index + 1)).join('\n')}\n\nאיזה רכב תרצו שאפרט או נשווה?`
      : `Here are vehicles shown in the verified sales catalogue:\n${shown.map((car, index) => carLine(car, locale, index + 1)).join('\n')}\n\nWhich vehicle would you like me to detail or compare?`,
  };
}

/**
 * Deterministic, catalogue-backed vehicle-sales responder.  It can display
 * only the fields returned by cars-for-sale; every question about a vehicle's
 * past, condition, commercial terms, or operational commitment becomes a
 * concise handoff rather than a fabricated answer.
 */
export function getCarSalesReply(input: string, locale: Locale, cars: CarForSale[], prior?: CarSalesContext): CarSalesReply {
  const text = normal(input);
  const context: CarSalesContext = prior?.mode === 'car_sale' ? prior : { mode: 'car_sale' };
  const mentioned = findMentionedCars(input, cars);
  const selected = mentioned.length ? mentioned : (context.selectedCarIds?.map((id) => cars.find((car) => car.id === id)).filter((car): car is CarForSale => Boolean(car)) ?? []);
  const selectedContext = selected.length ? { ...context, selectedCarIds: selected.map((car) => car.id) } : context;

  if (has(text, /מימון|הלוואה|תשלומים|finance|financing|loan|monthly payment/)) return agentReply(locale, 'finance', selectedContext, locale === 'he' ? 'מימון' : 'Financing');
  if (has(text, /טרייד.?אין|רכב להחלפה|trade.?in|part exchange/)) return agentReply(locale, 'trade_in', selectedContext, locale === 'he' ? 'טרייד־אין' : 'A trade-in');
  if (has(text, /היסטור|טיפולים|בעלות קודמת|תאונות קודמות|history|service records?|previous owner|accident history/)) return agentReply(locale, 'history', selectedContext, locale === 'he' ? 'היסטוריית הרכב' : 'Vehicle history');
  if (has(text, /אחריות|warranty|guarantee/)) return agentReply(locale, 'warranty', selectedContext, locale === 'he' ? 'אחריות' : 'Warranty');
  if (has(text, /(?:מצב ה?מכני|בדיקה|תקין|מנוע|גיר|mechanical|condition|inspection|engine|gearbox)/)) return agentReply(locale, 'mechanical', selectedContext, locale === 'he' ? 'מצב מכני או בדיקה' : 'Mechanical condition or inspection');
  if (has(text, /נסיעת מבחן|נסיעה לבדיקה|test drive|drive it/)) return agentReply(locale, 'test_drive', selectedContext, locale === 'he' ? 'נסיעת מבחן' : 'A test drive');
  if (has(text, /אספקה|מסירה|מתי אקבל|delivery|when can i get|collection date/)) return agentReply(locale, 'delivery', selectedContext, locale === 'he' ? 'מועד מסירה' : 'A delivery date');
  if (has(text, /הנחה|מחיר מיוחד|discount|deal|best price/)) return agentReply(locale, 'discount', selectedContext, locale === 'he' ? 'הנחה או מחיר מיוחד' : 'A discount or special price');

  const budget = numberFromBudget(input);
  if (budget) {
    const matches = cars.filter((car) => car.price <= budget);
    const budgetContext = { ...selectedContext, budget, lastAction: 'budget' as const };
    if (!matches.length) return {
      action: 'no_match', context: { ...budgetContext, lastAction: 'no_match' },
      reply: locale === 'he'
        ? `לא מצאתי בקטלוג המאומת רכב שמחירו עד ${currency(budget, locale)}. האם להציג את הקרובים ביותר מעל התקציב, בלי להניח שתאשרו מחיר אחר?`
        : `I did not find a verified catalogue vehicle priced up to ${currency(budget, locale)}. Would you like to see the closest options above that budget, without assuming you accept another price?`,
    };
    return {
      action: 'budget', context: budgetContext,
      reply: locale === 'he'
        ? `לפי תקציב של עד ${currency(budget, locale)}, אלה האפשרויות שמופיעות בקטלוג:\n${matches.slice(0, 3).map((car, index) => carLine(car, locale, index + 1)).join('\n')}\n\nאיזו מהן תרצו לפרט?`
        : `For a budget up to ${currency(budget, locale)}, these are the catalogue options:\n${matches.slice(0, 3).map((car, index) => carLine(car, locale, index + 1)).join('\n')}\n\nWhich one would you like detailed?`,
    };
  }

  if (has(text, /השוו|השווא|compare|versus| vs /)) {
    const compareCars = selected.length >= 2 ? selected.slice(0, 2) : cars.slice(0, 2);
    if (compareCars.length < 2) return catalogueReply(cars, locale, selectedContext, 'compare');
    return {
      action: 'compare', context: { ...selectedContext, lastAction: 'compare' },
      reply: locale === 'he'
        ? `השוואה לפי הנתונים המאומתים בקטלוג בלבד:\n\n${compareCars.map((car) => carDetails(car, locale)).join('\n\n')}\n\nאיזה פרט מהקטלוג חשוב לכם יותר?`
        : `Comparison using verified catalogue data only:\n\n${compareCars.map((car) => carDetails(car, locale)).join('\n\n')}\n\nWhich listed detail matters more to you?`,
    };
  }

  if (has(text, /משפחה|ילד|ילדה|תינוק|מזווד|family|child|baby|luggage|bags?/)) {
    return {
      action: 'family_luggage', context: withNeed(selectedContext, 'family/luggage', 'family_luggage'),
      reply: locale === 'he'
        ? 'רשמתי שהמרחב למשפחה או למטען חשוב. הקטלוג אינו מאמת נפח תא מטען או התאמה לכיסא ילדים, אז כמה נוסעים ומזוודות צריכים להיכנס?'
        : 'I have noted that family or luggage space matters. The catalogue does not verify boot volume or child-seat fit, so how many passengers and bags need to fit?',
    };
  }
  if (has(text, /עיר|כביש|נסיעות ארוכות|highway|city driving|long drive/)) {
    return {
      action: 'city_highway', context: withNeed(selectedContext, 'city/highway', 'city_highway'),
      reply: locale === 'he'
        ? 'רשמתי אם מדובר בעיקר בעיר או בכביש. לא אנחש ביצועים או צריכת דלק שאינם בקטלוג; מה חשוב יותר בנסיעה שלכם — נוחות, מרחב או תקציב?'
        : 'I have noted whether this is mainly city or highway driving. I will not guess performance or fuel use absent from the catalogue; which matters more for your trip—comfort, space, or budget?',
    };
  }
  if (has(text, /הנעה|חשמלי|היברידי|בנזין|דיזל|drivetrain|electric|hybrid|petrol|diesel/)) {
    return {
      action: 'verified_drive', context: { ...selectedContext, lastAction: 'verified_drive' },
      reply: locale === 'he'
        ? 'סוג ההנעה אינו אחד מהשדות המאומתים בקטלוג המכירה, לכן לא אייחס אותו לרכב. יש דגם מסוים מהקטלוג שתרצו שנציג יאמת?'
        : 'Powertrain is not one of the verified sales-catalogue fields, so I will not attribute one to a vehicle. Is there a specific listed model you want a representative to verify?',
    };
  }
  if (has(text, /איזו שנה|שנת ייצור|year/)) {
    return selected.length ? {
      action: 'year', context: { ...selectedContext, lastAction: 'year' },
      reply: locale === 'he' ? `שנת הייצור שמופיעה בקטלוג עבור ${carName(selected[0])} היא ${selected[0].year}. האם להציג גם את המחיר והקילומטראז׳?` : `The catalogue year for ${carName(selected[0])} is ${selected[0].year}. Would you like the listed price and mileage too?`,
    } : catalogueReply(cars, locale, selectedContext, 'year');
  }
  if (has(text, /קילומטראז|קילומטר|כמה קמ|mileage|how many km/)) {
    return selected.length ? {
      action: 'mileage', context: { ...selectedContext, lastAction: 'mileage' },
      reply: selected[0].km === null
        ? (locale === 'he' ? `אין קילומטראז׳ רשום בקטלוג עבור ${carName(selected[0])}; נציג יכול לאמת אותו. האם להעביר לבדיקה?` : `No mileage is listed for ${carName(selected[0])}; a representative can verify it. Shall I pass that for checking?`)
        : (locale === 'he' ? `הקילומטראז׳ שמופיע בקטלוג עבור ${carName(selected[0])} הוא ${selected[0].km.toLocaleString('he-IL')} ק״מ. האם להציג גם את המחיר?` : `The catalogue mileage for ${carName(selected[0])} is ${selected[0].km.toLocaleString('en-US')} km. Would you like the listed price too?`),
    } : catalogueReply(cars, locale, selectedContext, 'mileage');
  }
  if (has(text, /צבע|תוספות|אבזור|color|colour|extras|features/)) {
    return selected.length ? {
      action: 'color_extras', context: { ...selectedContext, lastAction: 'color_extras' },
      reply: locale === 'he'
        ? `${carName(selected[0])}: ${selected[0].color ? `צבע ${selected[0].color}` : 'אין צבע רשום בקטלוג'}${selected[0].extras ? `; תוספות שמופיעות: ${selected[0].extras}` : '; אין תוספות רשומות בקטלוג'}. האם תרצו להשוות אותו לרכב נוסף?`
        : `${carName(selected[0])}: ${selected[0].color ? `colour ${selected[0].color}` : 'no colour is listed'}${selected[0].extras ? `; listed extras: ${selected[0].extras}` : '; no extras are listed'}. Would you like to compare it with another vehicle?`,
    } : catalogueReply(cars, locale, selectedContext, 'color_extras');
  }
  if (has(text, /לא סומך|אמין|בטוח לקנות|trust|reliable|can i trust/)) {
    return {
      action: 'trust', context: { ...selectedContext, lastAction: 'trust' },
      reply: locale === 'he'
        ? 'זו שאלה לגמרי הוגנת. אציג רק את הפרטים המאומתים בקטלוג, ואעביר לנציג כל דבר שמצריך מסמך או בדיקה. איזה פרט תרצו לאמת קודם?'
        : 'That is entirely fair. I will show only verified catalogue details and pass anything needing a document or inspection to a representative. Which detail would you like verified first?',
    };
  }
  if (has(text, /יקר לי|יקר מדי|too expensive|too much|overpriced/)) {
    return {
      action: 'too_expensive', context: { ...selectedContext, lastAction: 'too_expensive' },
      reply: locale === 'he'
        ? 'מבין שהמחיר צריך להתאים. לא אמציא הנחה; אם תכתבו תקציב, אציג רק רכבים שמחירם מופיע עד אליו בקטלוג. מה התקציב הנוח לכם?'
        : 'I understand the price must fit. I will not invent a discount; if you share a budget, I can show only catalogue vehicles listed at or below it. What budget feels comfortable?',
    };
  }
  if (has(text, /אחשוב|אני חושב|think about it|need to think/)) {
    return {
      action: 'thinking', context: { ...selectedContext, lastAction: 'thinking' },
      reply: locale === 'he'
        ? 'בוודאי, אין לחץ ואין הבטחה לשמירת מחיר או רכב. מהו הפרט העיקרי שעוד עוזר לכם להחליט?'
        : 'Of course—there is no pressure and no promise to hold a price or vehicle. What is the main detail that would help you decide?',
    };
  }
  if (has(text, /מתחרה|חברה אחרת|competitor|another dealer|another company/)) {
    return {
      action: 'competitor', context: { ...selectedContext, lastAction: 'competitor' },
      reply: locale === 'he'
        ? 'אפשר להשוות באופן מסודר, אך לא אטען לגבי הצעה של חברה אחרת. איזה נתון מהקטלוג חשוב לכם להשוות — מחיר, שנת ייצור, קילומטראז׳, צבע או תוספות?'
        : 'We can compare methodically, but I will not make claims about another company’s offer. Which catalogue detail matters to compare—price, year, mileage, colour, or extras?',
    };
  }
  if (has(text, /רוצה לראות|לבוא לראות|פגישה|view(?:ing)?|see (?:the|it)|visit/)) return agentReply(locale, 'viewing', selectedContext, locale === 'he' ? 'רצון לראות את הרכב' : 'A request to view a vehicle');

  if (mentioned.length) {
    const car = mentioned[0];
    return {
      action: 'vehicle_selected', context: { ...selectedContext, lastAction: 'vehicle_selected' },
      reply: locale === 'he'
        ? `${carDetails(car, locale)}\n\nמה חשוב לכם לבדוק לגבי הרכב שמופיע בקטלוג?`
        : `${carDetails(car, locale)}\n\nWhat would you like to check about this listed vehicle?`,
    };
  }

  if (has(text, /מחיר|תקציב|price|budget|catalog|קטלוג|רכבים למכירה|cars? for sale|לקנות|רכישה|buy|purchase/)) return catalogueReply(cars, locale, selectedContext, 'catalog');
  return catalogueReply(cars, locale, selectedContext, 'purchase_start');
}
