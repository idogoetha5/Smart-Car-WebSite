import { activeModelEvaluation } from '@/lib/whatsapp-model-evaluation';
import { generateSmartCarContent, readJson } from '@/lib/whatsapp-gemini-client';

export type BotRoute = 'explore' | 'book' | 'service' | 'policy' | 'leasing' | 'sale' | 'human' | 'social';
export type VehicleDirection = 'compact' | 'family' | 'suv' | 'seven_seat' | 'none';
export type BotFields = Partial<Record<'pickupDate' | 'returnDate' | 'pickupLocation' | 'returnLocation' | 'vehicleNeed' | 'passengers' | 'luggage' | 'childSeats', { value: string; evidence: string }>>;

export type BotReading = {
  route: BotRoute;
  direction: VehicleDirection;
  reply: string;
  fields: BotFields;
  source: 'gemini';
  model: string;
};

export type GeminiBotContext = {
  locale: 'he' | 'en';
  phase: 'explore' | 'booking' | 'service';
  recent: Array<{ from: 'customer' | 'bot'; text: string }>;
  known: Record<string, string | number | undefined>;
  today: string;
};

/** Only the authenticated evaluation scope may select the private comparison model. */
export function botModelForCurrentScope(): string {
  return activeModelEvaluation()?.model ?? 'gemini-3.5-flash-lite';
}

const ROUTES: BotRoute[] = ['explore', 'book', 'service', 'policy', 'leasing', 'sale', 'human', 'social'];
const DIRECTIONS: VehicleDirection[] = ['compact', 'family', 'suv', 'seven_seat', 'none'];
const FIELD_NAMES = ['pickupDate', 'returnDate', 'pickupLocation', 'returnLocation', 'vehicleNeed', 'passengers', 'luggage', 'childSeats'] as const;

const INSTRUCTIONS = `You are SmartCar's helpful rental and service adviser in Israel. Read the customer's actual message and recent turns. Return only the JSON object requested by the schema.
Classify the current need: explore (advice or indecision), book (explicitly wants to start or continue a rental request), service (an existing rental/problem), policy (published business rules), leasing, sale, human, or social. A question about a car or price is NOT consent to book. A mention of taxi, bus or another rental company is NOT paid commercial driving.
For exploration, recommend one sensible SmartCar vehicle direction when the stated need supports it and explain one concrete benefit. Do not mention, recommend or compare outside transport or competitors, even if the customer names them. Do not announce this rule. Respect refusal. Keep advice separate from booking.
Do not invent a price, available car, delivery arrangement, child-seat or luggage fit, insurance eligibility, discount, completed booking, message sent, or human handoff. A vehicle group is only a direction until exact fit and availability are checked. Speak as a warm SmartCar representative to the customer, never about your own access, permissions, internal checks, model, tools, system, workflow or conversation state. The chat's name is SmartCar; do not volunteer that you are a bot, AI, or a named employee. The application answers direct identity questions truthfully. Say what SmartCar can do next in customer language. Do not use phrases like "אין לי גישה למלאי", "אין לי אישור", "לא אישרתי בשיחה הזו", "הצוות צריך לבדוק", or "כיוון לבדיקה". Keep essential customer-facing facts clear: a request, price, vehicle or appointment becomes final only after SmartCar confirms it. Answer the user's actual question before one useful next question. Never ask for pickup or return hours; the rental request needs dates and locations, not times. Do not ask again whether the customer wants to proceed after they have said yes; advance to the next missing concrete detail. Do not claim the customer gave a date or location unless it appears in the known fields. Use warm natural Hebrew or English matching the customer, under 65 words. No catalogue, links, stock closing or internal policy text.
Extract only facts explicitly supplied in the CURRENT customer message. Each nonempty field needs a verbatim evidence substring from that message. Dates may be ISO YYYY-MM-DD derived from an explicit date phrase relative to the supplied Israel date. For a range such as "10 עד 13 בנובמבר", extract both dates in the next occurrence of that month. A trip destination is not a pickup point. Seven seats or "7 מקומות" is a vehicle requirement, not a statement that seven people will travel. Never infer passengers from luggage. A suitcase count is luggage, never vehicleNeed. Never turn a question into a selected vehicle. Fields may be omitted.
Personal names, email addresses, phone numbers and exact street addresses must never appear in your JSON reply or extracted fields. Application code collects them separately. Latest customer correction wins.`;

const SCHEMA = {
  type: 'object',
  properties: {
    route: { type: 'string', enum: ROUTES },
    direction: { type: 'string', enum: DIRECTIONS },
    reply: { type: 'string' },
    fields: {
      type: 'object',
      properties: Object.fromEntries(FIELD_NAMES.map(name => [name, { type: 'object', properties: { value: { type: 'string' }, evidence: { type: 'string' } }, required: ['value', 'evidence'] }])),
    },
  },
  required: ['route', 'direction', 'reply', 'fields'],
};

function scrub(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
    .replace(/(?<![\d-])(?:\+972|0[2-9])[\d\s()-]{7,}/g, '[phone removed]')
    .replace(/(?:קוראים לי|שמי|השם שלי|my name is)\s+[\p{L}' -]{2,50}/giu, '[name removed]')
    .replace(/(?:רחוב|רח׳|street|st\.)\s+[^,.\n]{3,60}/gi, '[address removed]')
    .replace(/(?:^|[,;]\s*)(?:[\p{L}]{3,30}\s+){1,2}\d{1,4}(?=\s*(?:[,.;]|$))/gu, '[address removed]')
    .slice(0, 450);
}

function validatedFields(raw: unknown, message: string): BotFields {
  if (!raw || typeof raw !== 'object') return {};
  const result: BotFields = {};
  const record = raw as Record<string, unknown>;
  for (const name of FIELD_NAMES) {
    const item = record[name];
    if (!item || typeof item !== 'object') continue;
    const { value, evidence } = item as { value?: unknown; evidence?: unknown };
    if (typeof value !== 'string' || typeof evidence !== 'string' || !value.trim() || !evidence.trim()) continue;
    if (!message.toLocaleLowerCase().includes(evidence.trim().toLocaleLowerCase())) continue;
    if (value.length > 80 || evidence.length > 80 || /@|(?<![\d-])(?:\+972|0[2-9])[\d\s()-]{7,}/.test(value)) continue;
    if (name === 'vehicleNeed' && !/רכב|משפחת|קומפקט|ג[׳'י]?יפ|מיני|סדאן|שבעה מקומות|car|vehicle|suv|van|sedan|hatchback/i.test(evidence)) continue;
    result[name] = { value: value.trim(), evidence: evidence.trim() };
  }
  return result;
}

export async function readBotTurn(message: string, context: GeminiBotContext): Promise<BotReading | null> {
  // The fixed customer model is never selected by an environment chain or a
  // caller header. The owner-only authenticated evaluation scope is separate.
  const model = botModelForCurrentScope();
  const safeMessage = scrub(message);
  const recent = context.recent.slice(-8).map(item => ({ from: item.from, text: scrub(item.text) }));
  const known = Object.fromEntries(Object.entries(context.known).map(([key, value]) => [key, typeof value === 'string' ? scrub(value) : value]));
  const body = {
    systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify({ todayInIsrael: context.today, locale: context.locale, phase: context.phase, known, recent, message: safeMessage }) }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 700, responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: SCHEMA } } },
  };
  const response = await generateSmartCarContent({ model, body, timeoutMs: 8000 });
  if (!response.ok) return null;
  try {
    const raw = readJson(response.text) as Record<string, unknown>;
    if (!raw || !ROUTES.includes(raw.route as BotRoute) || !DIRECTIONS.includes(raw.direction as VehicleDirection) || typeof raw.reply !== 'string') return null;
    const reply = raw.reply.trim();
    if (!reply || reply.length > 650) return null;
    return { route: raw.route as BotRoute, direction: raw.direction as VehicleDirection, reply, fields: validatedFields(raw.fields, safeMessage), source: 'gemini', model };
  } catch { return null; }
}
