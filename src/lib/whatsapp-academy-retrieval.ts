import training from '@/lib/whatsapp-academy-bank.json';

type TeachingExample = typeof training[number];
const STOP = new Set(['אני', 'אתה', 'את', 'מה', 'זה', 'של', 'עם', 'לא', 'the', 'and', 'you', 'that', 'this', 'what', 'for', 'with']);
function words(text: string) {
  return new Set(text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(word => word.length > 2 && !STOP.has(word)));
}

/** Retrieves authored guidance from TRAINING ONLY. No answers/actions are selected. */
export function retrieveAcademyExamples(message: string, locale: 'he' | 'en', topics: string[], known?: { pickupLocation?: string; dropoffLocation?: string; passengers?: number }): TeachingExample[] {
  const query = words(message);
  const scored = training.filter(item => item.locale === locale && topics.includes(item.topic)).map(item => {
    const overlap = [...words(item.message)].filter(word => query.has(word)).length;
    const context = Number(Boolean(known?.pickupLocation && item.known.pickupLocation === known.pickupLocation))
      + Number(Boolean(known?.dropoffLocation && item.known.dropoffLocation === known.dropoffLocation))
      + Number(Boolean(known?.passengers && item.known.passengers === known.passengers));
    return { item, score: overlap * 5 + context };
  }).sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
  const chosen: TeachingExample[] = [];
  for (const { item, score } of scored) {
    if (score < 5 || chosen.some(other => other.topic === item.topic)) continue;
    chosen.push(item);
    if (chosen.length === 2) break;
  }
  return chosen;
}

export function renderAcademyExamples(examples: TeachingExample[]): string {
  if (!examples.length) return '';
  return `FICTIONAL COACHING EXAMPLES — never copy their dates, amounts or preferences into this customer's facts.\n`
    + examples.map(item => `Example ${item.id}\nFictional context: ${JSON.stringify(item.known)}\nCustomer wording: ${item.message}\nSkill: ${item.principle}\nAvoid: ${item.avoid.join('; ')}.`).join('\n\n');
}
