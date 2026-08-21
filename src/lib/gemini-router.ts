
import { GoogleGenAI, Type, Schema } from '@google/genai';
import type { FlowState } from './whatsapp-flow';

let _genai: GoogleGenAI | null = null;
function getGenAI() {
  if (_genai) return _genai;
  if (!process.env.GEMINI_API_KEY) return null;
  _genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return _genai;
}

const frontlineSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    humanResponse: {
      type: Type.STRING,
      description: "The exact textual response to send back to the user. Write in the same language as the user. Act as an Israeli car salesman: warm, sharp, service-oriented, direct, and professional. Keep it concise, friendly, and always aim to progress the booking or help effectively."
    },
    intent: {
      type: Type.STRING,
      enum: ['rental', 'policy', 'leasing', 'general', 'handoff'],
      description: "The primary intent of the user's message."
    },
    extractedFields: {
      type: Type.OBJECT,
      properties: {
        pickupDate: { type: Type.STRING, description: 'ISO Date YYYY-MM-DD for pickup', nullable: true },
        dropoffDate: { type: Type.STRING, description: 'ISO Date YYYY-MM-DD for return', nullable: true },
        pickupTime: { type: Type.STRING, description: 'Time HH:MM for pickup', nullable: true },
        returnTime: { type: Type.STRING, description: 'Time HH:MM for return', nullable: true },
        pickupLocation: { type: Type.STRING, description: 'City, branch, or address for pickup', nullable: true },
        dropoffLocation: { type: Type.STRING, description: 'City, branch, or address for return', nullable: true },
        vehiclePreference: { type: Type.STRING, enum: ['ECONOMY_COMPACT', 'SEDAN', 'SUV', 'VAN', 'LUXURY'], description: 'Vehicle type mentioned', nullable: true },
        passengers: { type: Type.INTEGER, description: 'Number of passengers', nullable: true },
        luggage: { type: Type.INTEGER, description: 'Number of bags', nullable: true },
        tripNeeds: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Needs like "young driver", "no credit card", "pets", "cross border"', nullable: true },
        customerName: { type: Type.STRING, description: 'The customer\'s full name, if they provided it.', nullable: true },
        customerEmail: { type: Type.STRING, description: 'The customer\'s email address, if they provided it.', nullable: true }
      }
    }
  },
  required: ['humanResponse', 'intent', 'extractedFields']
};

export type GeminiFrontlineResult = {
  humanResponse: string;
  intent: 'rental' | 'policy' | 'leasing' | 'general' | 'handoff';
  extractedFields: Partial<FlowState>;
};

export async function processWithGemini(
  input: string,
  currentState: FlowState | null,
  locale: string,
  systemContext: string
): Promise<GeminiFrontlineResult | null> {
  const genai = getGenAI();
  if (!genai) return null;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());

  const prompt = `You are the primary sales and service representative for "SmartCar" (an Israeli car rental company). 
Your personality: warm, sharp, professional, and practical Israeli car rental salesman.
CRITICAL RULES:
1. Your main goal is selling car rentals. Focus on guiding the user to rent a car.
2. EVERYTHING you say MUST be based STRICTLY on the Context Info provided below. Do NOT invent policies, branches, opening hours, vehicles, or rules that are not in the context.
3. If the user asks a question, answer it accurately based ONLY on the Context Info. If the answer is not in the context, do not invent one.
4. For leasing inquiries: NEVER give a price quote for leasing. Explain the conditions and benefits, and inform the user that a representative will provide the exact pricing.
5. Keep answers relatively concise and conversational.
6. DO NOT ASK ANY QUESTIONS in your response. The system will automatically ask the user for the next missing piece of information. Your ONLY job in \`humanResponse\` is to warmly acknowledge the information they just provided, or answer their policy/general questions. For example, if they provide dates, just say "מעולה, שמרתי את התאריכים" and STOP. Do not ask "איזה רכב תרצה?".
7. Speak in natural, correct Hebrew. Do not invent words or make spelling mistakes (e.g. use "נסדר" not "נסידר").

Today's date is: ${today}.
Current Booking State: ${JSON.stringify(currentState)}
Context Info (SmartCar Policies & Data):
${systemContext}

User Message: "${input}"

Your task:
1. Write the exact conversational acknowledgment/response to the user (in ${locale === 'he' ? 'Hebrew' : 'English'}). DO NOT ASK QUESTIONS.
2. Extract any rental fields they mentioned in their message (dates, locations, passengers, etc).
   CRUCIAL: Only extract fields that are currently missing or null in the Current Booking State, UNLESS the user explicitly says they want to change an existing field.
   CRUCIAL: If the user provides a time, date, or location, and you need to map it, map it to the MISSING field (e.g. if pickupDate exists, map a new date to dropoffDate).
   CRUCIAL: If the user mentions passengers or luggage but no specific vehicle, YOU MUST INFER the best vehiclePreference for them (e.g., VAN for 7+ people or heavy luggage, SUV for 5 people or lots of luggage, etc).
   CRUCIAL: Dates MUST ALWAYS be formatted strictly as ISO YYYY-MM-DD (e.g., 2026-09-01). If the year is omitted, assume the current year (${new Date().getFullYear()}). Never output text like "ראשון לספטמבר".
3. Classify their intent.`;

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await genai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: frontlineSchema,
          temperature: 0.7,
        }
      });

      const text = response.text;
      if (!text) return null;
      const parsed = JSON.parse(text);
      
      const cleaned: Record<string, any> = {};
      if (parsed.extractedFields) {
        for (const [k, v] of Object.entries(parsed.extractedFields)) {
          if (v !== null && v !== undefined && v !== '') cleaned[k] = v;
        }
      }

      return {
        humanResponse: parsed.humanResponse,
        intent: parsed.intent,
        extractedFields: cleaned
      };
    } catch (err: any) {
      lastErr = err;
      if (err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('high demand')) {
        console.warn(`[gemini-router] 503 High Demand (attempt ${attempt}/3). Retrying in 1s...`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      break; // break on other errors
    }
  }
  
  console.error('[gemini-router] Error processing with Gemini after retries:', lastErr);
  return null;
}
