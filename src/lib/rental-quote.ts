import { BRANCHES } from '@/lib/branches';
import { OFFICE_EMAIL, OFFICE_PHONE } from '@/lib/constants';
import {
  assistant400,
  assistant600,
  heebo400,
  heebo700,
  heebo800,
  heebo900,
  logo_png,
} from '@/lib/quote-assets';

export type RentalQuoteLocale = 'he' | 'en';
export type RentalDocumentMode = 'quote' | 'confirmation';
export type VatMode = 'included' | 'excluded' | 'not_applicable';
export type ExtraBilling = 'day' | 'flat';

export interface RentalQuoteVehicle {
  name: string;
  year: string;
  category: string;
  imageUrl: string;
  dailyPrice: number;
  quantity: number;
}

export interface RentalQuoteExtra {
  id: string;
  labelHe: string;
  labelEn: string;
  price: number;
  billing: ExtraBilling;
  quantity: number;
  selected: boolean;
}

export interface RentalQuoteData {
  quoteNumber: string;
  date: string;
  validUntil: string;
  locale: RentalQuoteLocale;
  documentMode: RentalDocumentMode;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  pickupDate: string;
  returnDate: string;
  pickupTime: string;
  returnTime: string;
  pickupLocation: string;
  returnLocation: string;
  vehicles: RentalQuoteVehicle[];
  extras: RentalQuoteExtra[];
  deliveryFee: number;
  discount: number;
  vatMode: VatMode;
  mileageAllowance: string;
  insuranceCoverage: string;
  deposit: string;
  deductible: string;
  fuelPolicy: string;
  notes: string;
}

export interface RentalQuoteTotals {
  days: number;
  vehicles: number;
  extras: number;
  subtotal: number;
  vat: number;
  total: number;
}

export const RENTAL_EXTRA_PRESETS: RentalQuoteExtra[] = [
  {
    id: 'insurance',
    labelHe: 'הפחתה או ביטול השתתפות בנזק',
    labelEn: 'Damage participation reduction or waiver',
    price: 45,
    billing: 'day',
    quantity: 1,
    selected: false,
  },
  {
    id: 'highway6',
    labelHe: 'חבילת כביש 6 ומנהרות',
    labelEn: 'Highway 6 and tunnels package',
    price: 35,
    billing: 'day',
    quantity: 1,
    selected: false,
  },
  {
    id: 'baby_seat',
    labelHe: 'כיסא בטיחות לילד',
    labelEn: 'Child safety seat',
    price: 20,
    billing: 'day',
    quantity: 1,
    selected: false,
  },
  {
    id: 'driver',
    labelHe: 'נהג נוסף',
    labelEn: 'Additional driver',
    price: 25,
    billing: 'day',
    quantity: 1,
    selected: false,
  },
];

export function emptyRentalVehicle(): RentalQuoteVehicle {
  return {
    name: '',
    year: new Date().getFullYear().toString(),
    category: '',
    imageUrl: '',
    dailyPrice: 0,
    quantity: 1,
  };
}

/**
 * A digits-only quotation number, e.g. `260730481902` — date then six random
 * digits.
 *
 * Customers read this number back over the phone, so it carries no letters.
 * It also names the stored PDF, and two quotations that collide would mean one
 * customer's link serving another customer's document — the previous scheme
 * reused a number every seventeen minutes, this one repeats at odds of a
 * million to one within the same day. Numbers already issued (including the
 * older `R…` form) keep working everywhere they are accepted.
 */
export function rentalQuoteNumber(): string {
  const now = new Date();
  const day = [now.getFullYear() % 100, now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('');
  const random = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  return `${day}${random}`;
}

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addIsoDays(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function calculateRentalDays(pickupDate: string, returnDate: string): number {
  const pickup = new Date(`${pickupDate}T00:00:00`);
  const dropoff = new Date(`${returnDate}T00:00:00`);
  if (Number.isNaN(pickup.getTime()) || Number.isNaN(dropoff.getTime())) return 1;
  return Math.max(1, Math.ceil((dropoff.getTime() - pickup.getTime()) / 86_400_000));
}

export function calculateRentalQuoteTotals(data: RentalQuoteData): RentalQuoteTotals {
  const days = calculateRentalDays(data.pickupDate, data.returnDate);
  const vehicles = data.vehicles.reduce(
    (sum, vehicle) => sum + Math.max(0, vehicle.dailyPrice) * days * Math.max(1, vehicle.quantity),
    0
  );
  const extras = data.extras
    .filter((extra) => extra.selected)
    .reduce((sum, extra) => {
      const multiplier = extra.billing === 'day' ? days : 1;
      return sum + Math.max(0, extra.price) * multiplier * Math.max(1, extra.quantity);
    }, 0);
  const subtotal = Math.max(0, vehicles + extras + Math.max(0, data.deliveryFee) - Math.max(0, data.discount));
  const vat = data.vatMode === 'excluded' ? Math.round(subtotal * 0.18) : 0;
  return { days, vehicles, extras, subtotal, vat, total: subtotal + vat };
}

export function normalizeWhatsAppPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('00')
    ? digits.slice(2)
    : digits.startsWith('0')
      ? `972${digits.slice(1)}`
      : digits;
  return /^\d{10,15}$/.test(normalized) ? normalized : null;
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeImageUrl(value: string): string {
  const url = value.trim();
  return /^(https?:\/\/|data:image\/)/i.test(url) ? escapeHtml(url) : '';
}

function money(value: number, locale: RentalQuoteLocale): string {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function displayDate(value: string, locale: RentalQuoteLocale): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value || '—';
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

const FONT_FACES = `
@font-face{font-family:'Heebo';font-weight:400;src:url(data:font/ttf;base64,${heebo400}) format('truetype')}
@font-face{font-family:'Heebo';font-weight:700;src:url(data:font/ttf;base64,${heebo700}) format('truetype')}
@font-face{font-family:'Heebo';font-weight:800;src:url(data:font/ttf;base64,${heebo800}) format('truetype')}
@font-face{font-family:'Heebo';font-weight:900;src:url(data:font/ttf;base64,${heebo900}) format('truetype')}
@font-face{font-family:'Assistant';font-weight:400;src:url(data:font/ttf;base64,${assistant400}) format('truetype')}
@font-face{font-family:'Assistant';font-weight:600;src:url(data:font/ttf;base64,${assistant600}) format('truetype')}
`;

const RENTAL_QUOTE_CSS = `
:root{--ink:#0d2b2b;--green:#2d5f5f;--orange:#e8743b;--paper:#f7f9f8;--line:#dfe8e5;--muted:#667773}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Assistant','Heebo',system-ui,sans-serif;color:var(--ink)}
.page{width:794px;min-height:1123px;background:var(--paper);display:flex;flex-direction:column;overflow:hidden}
.top{background:linear-gradient(135deg,#0d2b2b,#2d5f5f);color:#fff;padding:26px 42px 22px}
.brand{display:flex;align-items:center;justify-content:space-between;gap:24px}
.logo{width:142px;height:auto;filter:brightness(0) invert(1)}
.kicker{font-size:12px;letter-spacing:2.8px;color:#c9dcda;font-weight:600}
.title{margin-top:20px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px}
.title h1{font-family:'Heebo';font-size:29px;font-weight:900;line-height:1.1}
.quote-no{text-align:end;font-size:12px;color:#c9dcda}
.quote-no b{display:block;color:#fff;font-size:17px;margin-top:4px}
.meta{display:grid;grid-template-columns:1.35fr 1fr 1fr;margin:18px 42px 0;background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 8px 28px rgba(13,43,43,.07);overflow:hidden}
.meta>div{padding:12px 16px}
.meta>div+div{border-inline-start:1px solid var(--line)}
.label{font-size:10px;color:var(--muted);font-weight:600;margin-bottom:4px}
.value{font-family:'Heebo';font-size:14px;font-weight:700;color:var(--ink)}
.journey{margin:14px 42px 0;background:#eaf4f3;border-radius:14px;padding:14px 18px;display:grid;grid-template-columns:1fr 42px 1fr;align-items:center;gap:8px}
.stop{min-width:0}.stop .where{font-family:'Heebo';font-weight:800;font-size:15px}.stop .when{font-size:11px;color:var(--muted);margin-top:3px}
.arrow{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fff;color:var(--orange);font-size:21px;font-weight:800}
.section{margin:14px 42px 0}
.section-title{display:flex;align-items:center;gap:9px;margin-bottom:9px}
.section-title span{width:6px;height:21px;border-radius:6px;background:var(--orange)}
.section-title h2{font-family:'Heebo';font-size:17px;font-weight:800}
.vehicles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
.vehicle{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;display:grid;grid-template-columns:104px 1fr;gap:12px;min-height:112px;page-break-inside:avoid}
.vehicle-photo{height:86px;border-radius:10px;background:#eff4f2;display:flex;align-items:center;justify-content:center;overflow:hidden}
.vehicle-photo img{max-width:96%;max-height:80px;object-fit:contain}
.car-fallback{font-size:34px;opacity:.45}
.vehicle h3{font-family:'Heebo';font-size:16px;font-weight:800;margin-top:2px}
.vehicle .sub{font-size:10.5px;color:var(--muted);margin-top:2px}
.vehicle .price{font-family:'Heebo';font-size:20px;font-weight:900;color:var(--green);margin-top:10px}
.vehicle .price small{font-family:'Assistant';font-size:10px;color:var(--muted);font-weight:600}
.details{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.box{background:#fff;border:1px solid var(--line);border-radius:13px;padding:12px 14px}
.list{display:grid;gap:6px}
.line{display:flex;justify-content:space-between;gap:12px;font-size:11.5px;padding-bottom:6px;border-bottom:1px solid #edf1ef}
.line:last-child{border-bottom:0;padding-bottom:0}
.line b{font-family:'Heebo';font-weight:700;text-align:end}
.extras{display:grid;grid-template-columns:1fr 1fr;gap:7px 16px}
.extra{display:flex;align-items:center;gap:8px;font-size:11.5px}
.check{width:18px;height:18px;border-radius:50%;background:#e6f2ef;color:var(--green);display:flex;align-items:center;justify-content:center;font-weight:900;flex:none}
.summary{display:grid;grid-template-columns:1.15fr .85fr;gap:12px}
.notes{background:#fff;border:1px solid var(--line);border-radius:13px;padding:13px;font-size:11px;line-height:1.55;color:#4f625d;white-space:pre-wrap}
.total{background:linear-gradient(135deg,#0d2b2b,#2d5f5f);color:#fff;border-radius:14px;padding:14px 17px}
.total .row{display:flex;justify-content:space-between;font-size:11px;color:#c9dcda;margin-bottom:6px}
.total .grand{border-top:1px solid rgba(255,255,255,.2);margin-top:8px;padding-top:9px;display:flex;justify-content:space-between;align-items:baseline}
.total .grand span{font-size:12px}.total .grand b{font-family:'Heebo';font-size:27px;color:#f3a466}
.vat-note{text-align:end;font-size:9.5px;color:#b7cbc7;margin-top:4px}
.legal{margin:11px 42px 0;padding:9px 13px;border-inline-start:4px solid var(--orange);background:#fff4ed;border-radius:9px;font-size:10px;line-height:1.5;color:#5f5650}
.thanks{margin:11px 42px 9px;text-align:center;font-family:'Heebo';font-size:15px;font-weight:800;color:var(--green)}
.footer{margin-top:auto;background:#0d2b2b;color:#fff;padding:13px 42px}
.footer-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;font-size:9.5px;color:#b7cbc7}
.footer-grid b{display:block;color:#fff;font-size:11px;margin-bottom:2px}
.footer-bottom{text-align:center;border-top:1px solid #31504b;margin-top:9px;padding-top:8px;font-size:10px;color:#9db4af;direction:ltr}
@page{size:794px 1123px;margin:0}
`;

const COPY = {
  he: {
    quoteTitle: 'הצעת מחיר להשכרת רכב',
    confirmationTitle: 'אישור הזמנה וסיכום עסקה',
    quote: 'מספר הצעה',
    confirmationNumber: 'מספר אישור',
    customer: 'לכבוד',
    date: 'תאריך',
    valid: 'בתוקף עד',
    confirmationValid: 'התנאים בתוקף עד',
    pickup: 'איסוף',
    return: 'החזרה',
    vehicles: 'הרכבים בהצעה',
    confirmationVehicles: 'הרכבים בהזמנה',
    perDay: 'ליום',
    quantity: 'כמות',
    extras: 'תוספות שנבחרו',
    details: 'פרטי ההשכרה',
    days: 'תקופת השכרה',
    daysValue: (days: number) => `${days} ימים`,
    mileage: 'מגבלת קילומטרים',
    insurance: 'כיסוי ביטוחי',
    deposit: 'פיקדון',
    deductible: 'השתתפות עצמית',
    fuel: 'מדיניות דלק',
    vehicleCost: 'רכבים',
    extrasCost: 'תוספות',
    deliveryFee: 'מסירה / החזרה',
    discount: 'הנחה',
    vat: 'מע״מ 18%',
    total: 'סה״כ להצעה',
    confirmationTotal: 'סה״כ לעסקה',
    includedVat: 'המחיר כולל מע״מ',
    excludedVat: 'המחיר לפני מע״מ; המע״מ נוסף בסיכום',
    noVat: 'לא חל מע״מ על הצעה זו',
    notes: 'הערות',
    noNotes: 'הפרטים הסופיים יתואמו מול נציג SmartCar.',
    confirmationNoNotes: 'לכל שאלה נוספת נציגי SmartCar זמינים עבורכם.',
    quoteLegal: 'הצעה זו אינה מהווה אישור הזמנה או התחייבות לזמינות רכב מסוים. ההזמנה, המחיר והתנאים יאושרו סופית בכתב על ידי נציג SmartCar ובכפוף להסכם ההשכרה.',
    confirmationLegal: 'מסמך זה מסכם את פרטי ההזמנה שאושרו מול נציג SmartCar. ההשכרה כפופה לתנאי הסכם ההשכרה, להצגת מסמכים תקפים ולתנאים שנקבעו במסמך זה.',
    quoteValidity: (date: string) => `הצעה זו בתוקף עד ${date}.`,
    confirmationValidity: (date: string) =>
      `התנאים במסמך זה בתוקף עד ${date}.`,
    thanks: 'תודה שבחרתם SmartCar. אנחנו כאן כדי להפוך כל נסיעה לפשוטה ונעימה יותר.',
    flat: 'חד-פעמי',
    messageGreeting: (name: string) => `שלום ${name},`,
    messageIntro: (documentName: string, quoteNumber: string) =>
      `הכנו עבורך את ${documentName} מספר ${quoteNumber} להשכרת רכב מ־SmartCar.`,
    messageDocumentQuote: 'הצעת המחיר',
    messageDocumentConfirmation: 'אישור ההזמנה וסיכום העסקה',
    messageActionQuote: 'לצפייה ולהורדת הצעת המחיר:',
    messageActionConfirmation: 'לצפייה ולהורדת אישור ההזמנה:',
    messageValidityQuote: (date: string) =>
      `ההצעה והקישור תקפים עד לתאריך ${date}. נשמח לעמוד לרשותך לכל שאלה.`,
    messageValidityConfirmation: (date: string) =>
      `המסמך והקישור תקפים עד לתאריך ${date}. נשמח לעמוד לרשותך לכל שאלה.`,
  },
  en: {
    quoteTitle: 'Car Rental Quotation',
    confirmationTitle: 'Booking Confirmation and Deal Summary',
    quote: 'Quote number',
    confirmationNumber: 'Confirmation number',
    customer: 'Prepared for',
    date: 'Date',
    valid: 'Valid until',
    confirmationValid: 'Terms valid until',
    pickup: 'Pick-up',
    return: 'Return',
    vehicles: 'Vehicles in this quote',
    confirmationVehicles: 'Vehicles in this booking',
    perDay: 'per day',
    quantity: 'Quantity',
    extras: 'Selected extras',
    details: 'Rental details',
    days: 'Rental period',
    daysValue: (days: number) => `${days} days`,
    mileage: 'Mileage allowance',
    insurance: 'Insurance coverage',
    deposit: 'Deposit',
    deductible: 'Deductible',
    fuel: 'Fuel policy',
    vehicleCost: 'Vehicles',
    extrasCost: 'Extras',
    deliveryFee: 'Delivery / collection',
    discount: 'Discount',
    vat: '18% VAT',
    total: 'Quote total',
    confirmationTotal: 'Deal total',
    includedVat: 'The price includes VAT',
    excludedVat: 'The price excludes VAT; VAT is added in the summary',
    noVat: 'VAT does not apply to this quotation',
    notes: 'Notes',
    noNotes: 'Final details will be coordinated with a SmartCar representative.',
    confirmationNoNotes: 'Your SmartCar representative is available for any further questions.',
    quoteLegal: 'This quotation is not a booking confirmation or a commitment that a specific vehicle is available. The booking, price and terms are confirmed in writing by a SmartCar representative and remain subject to the rental agreement.',
    confirmationLegal: 'This document summarizes the booking details approved with a SmartCar representative. The rental remains subject to the rental agreement, valid documents and the terms stated in this document.',
    quoteValidity: (date: string) => `This quotation is valid until ${date}.`,
    confirmationValidity: (date: string) =>
      `The terms in this document are valid until ${date}.`,
    thanks: 'Thank you for choosing SmartCar. We are here to make every journey simpler and more enjoyable.',
    flat: 'one-time',
    messageGreeting: (name: string) => `Hello ${name},`,
    messageIntro: (documentName: string, quoteNumber: string) =>
      `We have prepared your car rental ${documentName} number ${quoteNumber} from SmartCar.`,
    messageDocumentQuote: 'quotation',
    messageDocumentConfirmation: 'booking confirmation and deal summary',
    messageActionQuote: 'To view and download the quotation:',
    messageActionConfirmation: 'To view and download the booking confirmation:',
    messageValidityQuote: (date: string) =>
      `The quotation and the link are valid until ${date}. We will be happy to help with any questions.`,
    messageValidityConfirmation: (date: string) =>
      `This document and the link are valid until ${date}. We will be happy to help with any questions.`,
  },
} as const;

/**
 * Shrinks the rendered page just enough to stay on a single A4 sheet.
 *
 * Four vehicles, long free-text terms or English wording that wraps to an
 * extra line all push the document past 1123px, which used to produce a second
 * page holding nothing but a sliver of the footer. Compensating the width keeps
 * the design full-bleed — only the effective type size comes down, by a few
 * percent, and only when the content genuinely does not fit.
 *
 * Runs both in the browser preview and inside the PDF renderer, so what the
 * representative sees is what the customer receives. Written self-contained on
 * purpose: it is serialized into the Puppeteer page.
 */
export function fitRentalQuoteToPage(target?: Document): void {
  const doc = target ?? document;
  const page = doc.querySelector('.page');
  if (!(page instanceof HTMLElement)) return;

  const width = 794;
  const height = 1123;
  page.style.zoom = '';
  page.style.width = '';
  page.style.minHeight = '';

  let zoom = 1;
  for (let pass = 0; pass < 5; pass += 1) {
    const rendered = page.getBoundingClientRect().height;
    if (rendered <= height + 0.5) break;
    zoom *= height / rendered;
    page.style.zoom = String(zoom);
    page.style.width = `${width / zoom}px`;
    page.style.minHeight = `${height / zoom}px`;
  }
}

/** The document's validity date as the customer reads it (e.g. 29.08.2026). */
export function rentalQuoteValidUntilText(data: RentalQuoteData): string {
  return displayDate(data.validUntil, data.locale);
}

/**
 * The WhatsApp message the representative sends with the document link.
 *
 * States the real validity date rather than a fixed number of days: a quotation
 * holds for a month, and the link now expires with it, so one date has to be
 * true for both.
 */
export function rentalQuoteWhatsAppMessage(
  data: RentalQuoteData,
  link: string
): string {
  const t = COPY[data.locale];
  const isConfirmation = data.documentMode === 'confirmation';
  const validUntil = rentalQuoteValidUntilText(data);

  return [
    t.messageGreeting(data.customerName),
    '',
    t.messageIntro(
      isConfirmation ? t.messageDocumentConfirmation : t.messageDocumentQuote,
      data.quoteNumber
    ),
    '',
    isConfirmation ? t.messageActionConfirmation : t.messageActionQuote,
    link,
    '',
    isConfirmation
      ? t.messageValidityConfirmation(validUntil)
      : t.messageValidityQuote(validUntil),
  ].join('\n');
}

export function rentalQuoteHeadHTML(): string {
  return `<style>${FONT_FACES}${RENTAL_QUOTE_CSS}</style>`;
}

export function generateRentalQuoteHTML(data: RentalQuoteData): string {
  const dir = data.locale === 'he' ? 'rtl' : 'ltr';
  return `<!doctype html><html lang="${data.locale}" dir="${dir}"><head><meta charset="utf-8">${rentalQuoteHeadHTML()}</head><body>${rentalQuoteBodyHTML(data)}</body></html>`;
}

export function rentalQuoteBodyHTML(data: RentalQuoteData): string {
  const t = COPY[data.locale];
  // A confirmation is the same document with settled wording: it states the
  // deal was agreed instead of warning that nothing is agreed yet, so every
  // label that says "quotation" has to move with the title.
  const isConfirmation = data.documentMode === 'confirmation';
  const documentTitle = isConfirmation ? t.confirmationTitle : t.quoteTitle;
  // The exact validity date is stated in the legal note as well as the header
  // strip: it is what the price holds until, and it is when the customer's
  // link stops opening.
  const validityNote = isConfirmation
    ? t.confirmationValidity(displayDate(data.validUntil, data.locale))
    : t.quoteValidity(displayDate(data.validUntil, data.locale));
  const legalText = `${validityNote} ${
    isConfirmation ? t.confirmationLegal : t.quoteLegal
  }`;
  const referenceLabel = isConfirmation ? t.confirmationNumber : t.quote;
  const validLabel = isConfirmation ? t.confirmationValid : t.valid;
  const vehiclesLabel = isConfirmation ? t.confirmationVehicles : t.vehicles;
  const totalLabel = isConfirmation ? t.confirmationTotal : t.total;
  const noNotesText = isConfirmation ? t.confirmationNoNotes : t.noNotes;
  const totals = calculateRentalQuoteTotals(data);
  const activeVehicles = data.vehicles.filter((vehicle) => vehicle.name.trim());
  const selectedExtras = data.extras.filter((extra) => extra.selected);
  const arrow = data.locale === 'he' ? '←' : '→';
  const vatNote =
    data.vatMode === 'included'
      ? t.includedVat
      : data.vatMode === 'excluded'
        ? t.excludedVat
        : t.noVat;

  const vehicleCards = activeVehicles
    .map((vehicle) => {
      const imageUrl = safeImageUrl(vehicle.imageUrl);
      const subtitle = [vehicle.year, vehicle.category].filter(Boolean).join(' · ');
      return `<article class="vehicle">
        <div class="vehicle-photo">${imageUrl ? `<img src="${imageUrl}" alt="">` : '<span class="car-fallback">🚗</span>'}</div>
        <div>
          <h3>${escapeHtml(vehicle.name)}</h3>
          <div class="sub">${escapeHtml(subtitle || 'SmartCar')}</div>
          <div class="price">₪${money(vehicle.dailyPrice, data.locale)} <small>${t.perDay}</small></div>
          ${vehicle.quantity > 1 ? `<div class="sub">${t.quantity}: ${vehicle.quantity}</div>` : ''}
        </div>
      </article>`;
    })
    .join('');

  const extraRows = selectedExtras
    .map((extra) => {
      const label = data.locale === 'he' ? extra.labelHe : extra.labelEn;
      const billing = extra.billing === 'day' ? t.perDay : t.flat;
      const quantity = extra.quantity > 1 ? ` × ${extra.quantity}` : '';
      return `<div class="extra"><span class="check">✓</span><span>${escapeHtml(label)}${quantity} — ₪${money(extra.price, data.locale)} ${billing}</span></div>`;
    })
    .join('');

  const detailRows = [
    [t.days, t.daysValue(totals.days)],
    [t.mileage, data.mileageAllowance || '—'],
    [t.insurance, data.insuranceCoverage || '—'],
    [t.deposit, data.deposit || '—'],
    [t.deductible, data.deductible || '—'],
    [t.fuel, data.fuelPolicy || '—'],
  ];

  return `<main class="page">
    <header class="top">
      <div class="brand">
        <img class="logo" src="data:image/png;base64,${logo_png}" alt="SmartCar">
        <div class="kicker">${data.locale === 'he' ? 'שירות אישי · בכל הארץ' : 'Personal service · Nationwide'}</div>
      </div>
      <div class="title">
        <h1>${documentTitle}</h1>
        <div class="quote-no">${referenceLabel}<b>${escapeHtml(data.quoteNumber)}</b></div>
      </div>
    </header>

    <section class="meta">
      <div><div class="label">${t.customer}</div><div class="value">${escapeHtml(data.customerName || '—')}</div></div>
      <div><div class="label">${t.date}</div><div class="value">${displayDate(data.date, data.locale)}</div></div>
      <div><div class="label">${validLabel}</div><div class="value">${displayDate(data.validUntil, data.locale)}</div></div>
    </section>

    <section class="journey">
      <div class="stop"><div class="label">${t.pickup}</div><div class="where">${escapeHtml(data.pickupLocation || '—')}</div><div class="when">${displayDate(data.pickupDate, data.locale)} · ${escapeHtml(data.pickupTime || '—')}</div></div>
      <div class="arrow">${arrow}</div>
      <div class="stop"><div class="label">${t.return}</div><div class="where">${escapeHtml(data.returnLocation || '—')}</div><div class="when">${displayDate(data.returnDate, data.locale)} · ${escapeHtml(data.returnTime || '—')}</div></div>
    </section>

    <section class="section">
      <div class="section-title"><span></span><h2>${vehiclesLabel}</h2></div>
      <div class="vehicles">${vehicleCards || `<div class="notes">${data.locale === 'he' ? 'יש להוסיף לפחות רכב אחד להצעה.' : 'Add at least one vehicle to the quotation.'}</div>`}</div>
    </section>

    <section class="section details">
      <div class="box">
        <div class="section-title"><span></span><h2>${t.details}</h2></div>
        <div class="list">${detailRows.map(([label, value]) => `<div class="line"><span>${label}</span><b>${escapeHtml(value)}</b></div>`).join('')}</div>
      </div>
      <div class="box">
        <div class="section-title"><span></span><h2>${t.extras}</h2></div>
        <div class="extras">${extraRows || `<span class="label">${data.locale === 'he' ? 'ללא תוספות' : 'No extras selected'}</span>`}</div>
      </div>
    </section>

    <section class="section summary">
      <div class="notes"><b>${t.notes}</b><br>${escapeHtml(data.notes || noNotesText)}</div>
      <div class="total">
        <div class="row"><span>${t.vehicleCost}</span><b>₪${money(totals.vehicles, data.locale)}</b></div>
        <div class="row"><span>${t.extrasCost}</span><b>₪${money(totals.extras, data.locale)}</b></div>
        ${data.deliveryFee ? `<div class="row"><span>${t.deliveryFee}</span><b>₪${money(data.deliveryFee, data.locale)}</b></div>` : ''}
        ${data.discount ? `<div class="row"><span>${t.discount}</span><b>−₪${money(data.discount, data.locale)}</b></div>` : ''}
        ${totals.vat ? `<div class="row"><span>${t.vat}</span><b>₪${money(totals.vat, data.locale)}</b></div>` : ''}
        <div class="grand"><span>${totalLabel}</span><b>₪${money(totals.total, data.locale)}</b></div>
        <div class="vat-note">${vatNote}</div>
      </div>
    </section>

    <div class="legal">${legalText}</div>
    <div class="thanks">${t.thanks}</div>

    <footer class="footer">
      <div class="footer-grid">
        ${BRANCHES.filter((branch) => branch.id !== 'airport').map((branch) => `<div><b>${escapeHtml(data.locale === 'he' ? branch.cityHe : branch.cityEn)}</b>${escapeHtml(data.locale === 'he' ? branch.streetHe : branch.streetEn)} · ${branch.phone}</div>`).join('')}
      </div>
      <div class="footer-bottom">www.smartcar.co.il · ${OFFICE_EMAIL} · ${OFFICE_PHONE}</div>
    </footer>
  </main>`;
}
