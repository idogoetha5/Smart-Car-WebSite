/** The same starting topics offered by the website demo, for live WhatsApp. */
const topics = [
  { id: 'rental', he: 'השכרת רכב', en: 'Car rental', messageHe: 'אני רוצה לשכור רכב', messageEn: 'I want to rent a car' },
  { id: 'booking', he: 'הזמנה קיימת', en: 'Existing booking', messageHe: 'יש לי הזמנה קיימת ואני צריך עזרה', messageEn: 'I have an existing booking and need help' },
  { id: 'leasing', he: 'ליסינג', en: 'Leasing', messageHe: 'אני מתעניין בליסינג', messageEn: 'I am interested in leasing' },
  { id: 'purchase', he: 'רכישת רכב', en: 'Buy a car', messageHe: 'אני מחפש רכב לקנייה', messageEn: 'I am looking to buy a car' },
  { id: 'roadside', he: 'עזרה בדרך', en: 'Roadside help', messageHe: 'שכרתי רכב ויש תקלה, אני צריך עזרה בדרך', messageEn: 'I rented a car and have a roadside problem' },
  { id: 'english', he: 'English', en: 'English', messageHe: 'English', messageEn: 'English' },
] as const;

/** Only a conversational greeting, never an arbitrary bot answer, receives a menu. */
export function quickStartListForGreeting(body: string) {
  const he = /^(?:היי(?: שוב)?|שלום|אהלן)[^\n]*?(?:איך אפשר לעזור לך היום\?|מה תרצה לבדוק\?)$/u.test(body);
  const en = /^(?:Hi(?: again)?|Hello)[^\n]*?(?:How can I help(?: you)? today\?|What would you like to check\?)$/i.test(body);
  if (!he && !en) return null;
  return {
    type: 'list' as const,
    body: { text: body },
    action: {
      button: he ? 'בחירת נושא' : 'Choose a topic',
      sections: [{ title: he ? 'איך אפשר לעזור?' : 'How can we help?', rows: topics.map(topic => ({ id: `smartcar_${he ? 'he' : 'en'}_${topic.id}`, title: he ? topic.he : topic.en })) }],
    },
  };
}

/** A provider's list reply is treated like the matching demo quick reply. */
export function quickStartMessageFromReply(id: string | undefined): string | null {
  const selected = /^(?:smartcar_)(he|en)_([a-z]+)$/.exec(id ?? '');
  if (!selected) return null;
  const topic = topics.find(item => item.id === selected[2]);
  return topic ? selected[1] === 'he' ? topic.messageHe : topic.messageEn : null;
}
