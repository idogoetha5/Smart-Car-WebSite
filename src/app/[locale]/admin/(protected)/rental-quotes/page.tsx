'use client';

import {
  Download,
  MessageCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BRANCHES } from '@/lib/branches';
import {
  RENTAL_EXTRA_PRESETS,
  addIsoDays,
  calculateRentalQuoteTotals,
  emptyRentalVehicle,
  fitRentalQuoteToPage,
  isoToday,
  rentalQuoteBodyHTML,
  rentalQuoteHeadHTML,
  rentalQuoteNumber,
  type ExtraBilling,
  type RentalDocumentMode,
  type RentalQuoteData,
  type RentalQuoteExtra,
  type RentalQuoteLocale,
  type RentalQuoteVehicle,
  type VatMode,
} from '@/lib/rental-quote';

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;
const MAX_VEHICLES = 4;
const MAX_EXTRAS = 12;

// The coverage the representative agreed with the customer is printed word for
// word, so these are suggestions in the document's own language — never a
// closed list, and never a silent default.
const INSURANCE_SUGGESTIONS: Record<RentalQuoteLocale, readonly string[]> = {
  he: [
    'כיסוי ביטוחי בסיסי',
    'כיסוי ביטוחי מורחב',
    'הפחתת השתתפות עצמית',
    'ביטול השתתפות עצמית',
  ],
  en: [
    'Basic insurance coverage',
    'Extended insurance coverage',
    'Reduced deductible',
    'Deductible waiver',
  ],
};

interface InventoryVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  category: string;
  price_per_day: number | null;
  deposit_amount: number | null;
  mileage_limit: number | null;
  image_urls: string[] | null;
}

const TEXT = {
  he: {
    pageTitle: 'הצעת מחיר להשכרה',
    outputLanguage: 'שפת ההצעה',
    hebrew: 'עברית',
    english: 'אנגלית',
    download: 'הורדת PDF',
    downloading: 'מכין PDF...',
    whatsapp: 'שליחה ב־WhatsApp',
    preparingWhatsapp: 'מכין קישור...',
    quoteDetails: 'פרטי ההצעה',
    quoteNumber: 'מספר הצעה',
    quoteDate: 'תאריך ההצעה',
    validUntil: 'בתוקף עד',
    confirmationToggle: 'הפוך לאישור הזמנה וסיכום עסקה',
    confirmationHint:
      'המסמך ייצא בכותרת „אישור הזמנה וסיכום עסקה” ללא ההסתייגות של הצעת מחיר.',
    customer: 'פרטי הלקוח',
    customerName: 'שם הלקוח',
    customerPhone: 'טלפון ל־WhatsApp',
    customerEmail: 'דוא״ל (אופציונלי)',
    rental: 'פרטי ההשכרה',
    pickupDate: 'תאריך איסוף',
    returnDate: 'תאריך החזרה',
    pickupTime: 'שעת איסוף',
    returnTime: 'שעת החזרה',
    pickupLocation: 'מקום איסוף',
    returnLocation: 'מקום החזרה',
    locationPlaceholder: 'בחר סניף או הקלד כתובת מלאה',
    vehicles: 'רכבים בהצעה',
    addVehicle: 'הוספת רכב',
    vehicle: 'רכב',
    removeVehicle: 'הסרת רכב',
    removeExtra: 'הסרת תוספת',
    inventory: 'בחירה ממאגר הרכבים (אופציונלי)',
    manual: '— מילוי ידני —',
    vehicleName: 'שם הרכב',
    year: 'שנת דגם',
    category: 'קטגוריה',
    dailyPrice: 'מחיר ליום (₪)',
    quantity: 'כמות',
    imageUrl: 'כתובת תמונה (מתמלאת אוטומטית)',
    extras: 'תוספות ואפסייל',
    addExtra: 'הוספת תוספת',
    selected: 'להוסיף להצעה',
    extraNameHe: 'שם בעברית',
    extraNameEn: 'שם באנגלית',
    price: 'מחיר (₪)',
    billing: 'אופן חיוב',
    perDay: 'ליום',
    flat: 'חד־פעמי',
    termsAndPrice: 'מחיר ותנאים',
    mileage: 'מגבלת קילומטרים',
    insurance: 'כיסוי ביטוחי',
    insuranceHint: 'בחר מהרשימה או כתוב את הכיסוי המדויק שסוכם',
    deposit: 'פיקדון',
    deductible: 'השתתפות עצמית',
    deductiblePlaceholder: 'סכום או תנאי מדויק, למשל ₪1,500',
    fuelPolicy: 'מדיניות דלק',
    deliveryFee: 'דמי מסירה / החזרה (₪)',
    discount: 'הנחה (₪)',
    vat: 'מע״מ',
    vatIncluded: 'המחיר כולל מע״מ',
    vatExcluded: 'המחיר לפני מע״מ',
    vatNotApplicable: 'לא חל מע״מ',
    notes: 'הערות להצעה',
    priceSummary: 'סיכום מחיר',
    rentalDays: 'ימי השכרה',
    vehiclesTotal: 'רכבים',
    extrasTotal: 'תוספות',
    subtotal: 'לפני מע״מ',
    vatAmount: 'מע״מ',
    total: 'סה״כ',
    preview: 'תצוגה מקדימה של הצעת המחיר',
    requiredError: 'יש למלא שם לקוח, טלפון, תאריכים, מיקומים ולפחות רכב אחד.',
    insuranceRequired: 'יש לבחור או להזין כיסוי ביטוחי לפני יצירת המסמך.',
    validUntilPast:
      'תאריך התוקף של ההצעה כבר עבר. יש לבחור תאריך תוקף עתידי — הקישור ללקוח תקף עד אותו תאריך.',
    pdfError: 'לא ניתן היה ליצור את ה־PDF. נסה שוב.',
    whatsappError: 'לא ניתן היה להכין את ההודעה ל־WhatsApp. נסה שוב.',
    expired: 'ההתחברות פגה. מעביר אותך לדף ההתחברות...',
    customExtraHe: 'תוספת מותאמת',
    customExtraEn: 'Custom extra',
    defaultMileage: 'לפי תקופת ההשכרה ותנאי ההצעה',
    defaultDeposit: 'לפי קבוצת הרכב ותנאי ההשכרה',
    defaultFuel: 'החזרה עם אותה כמות דלק שהתקבלה',
  },
  en: {
    pageTitle: 'Rental quotation',
    outputLanguage: 'Quotation language',
    hebrew: 'Hebrew',
    english: 'English',
    download: 'Download PDF',
    downloading: 'Preparing PDF...',
    whatsapp: 'Send via WhatsApp',
    preparingWhatsapp: 'Preparing link...',
    quoteDetails: 'Quotation details',
    quoteNumber: 'Quote number',
    quoteDate: 'Quote date',
    validUntil: 'Valid until',
    confirmationToggle: 'Create as booking confirmation and deal summary',
    confirmationHint:
      'The document is titled "Booking Confirmation and Deal Summary" without the quotation disclaimer.',
    customer: 'Customer details',
    customerName: 'Customer name',
    customerPhone: 'WhatsApp phone',
    customerEmail: 'Email (optional)',
    rental: 'Rental details',
    pickupDate: 'Pick-up date',
    returnDate: 'Return date',
    pickupTime: 'Pick-up time',
    returnTime: 'Return time',
    pickupLocation: 'Pick-up location',
    returnLocation: 'Return location',
    locationPlaceholder: 'Choose a branch or type a full address',
    vehicles: 'Vehicles in this quotation',
    addVehicle: 'Add vehicle',
    vehicle: 'Vehicle',
    removeVehicle: 'Remove vehicle',
    removeExtra: 'Remove extra',
    inventory: 'Choose from vehicle inventory (optional)',
    manual: '— Manual entry —',
    vehicleName: 'Vehicle name',
    year: 'Model year',
    category: 'Category',
    dailyPrice: 'Daily price (₪)',
    quantity: 'Quantity',
    imageUrl: 'Image URL (filled automatically)',
    extras: 'Extras and add-ons',
    addExtra: 'Add extra',
    selected: 'Include in quotation',
    extraNameHe: 'Hebrew name',
    extraNameEn: 'English name',
    price: 'Price (₪)',
    billing: 'Billing',
    perDay: 'Per day',
    flat: 'One-time',
    termsAndPrice: 'Price and terms',
    mileage: 'Mileage allowance',
    insurance: 'Insurance coverage',
    insuranceHint: 'Pick a suggestion or type the exact agreed coverage',
    deposit: 'Deposit',
    deductible: 'Deductible',
    deductiblePlaceholder: 'Exact amount or condition, e.g. ₪1,500',
    fuelPolicy: 'Fuel policy',
    deliveryFee: 'Delivery / collection fee (₪)',
    discount: 'Discount (₪)',
    vat: 'VAT',
    vatIncluded: 'Price includes VAT',
    vatExcluded: 'Price excludes VAT',
    vatNotApplicable: 'VAT does not apply',
    notes: 'Quotation notes',
    priceSummary: 'Price summary',
    rentalDays: 'Rental days',
    vehiclesTotal: 'Vehicles',
    extrasTotal: 'Extras',
    subtotal: 'Before VAT',
    vatAmount: 'VAT',
    total: 'Total',
    preview: 'Rental quotation preview',
    requiredError: 'Enter a customer name, phone, dates, locations and at least one vehicle.',
    insuranceRequired: 'Choose or type the insurance coverage before creating the document.',
    validUntilPast:
      'The validity date has already passed. Choose a future date — the customer link is valid until that date.',
    pdfError: 'The PDF could not be created. Please try again.',
    whatsappError: 'The WhatsApp message could not be prepared. Please try again.',
    expired: 'Your session expired. Redirecting to login...',
    customExtraHe: 'תוספת מותאמת',
    customExtraEn: 'Custom extra',
    defaultMileage: 'Based on the rental period and quotation terms',
    defaultDeposit: 'Based on the vehicle group and rental terms',
    defaultFuel: 'Return with the same fuel level as received',
  },
} as const;

function money(value: number, locale: string) {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export default function RentalQuotesPage() {
  const adminLocale = useLocale();
  const isHe = adminLocale === 'he';
  const t = TEXT[isHe ? 'he' : 'en'];
  const today = useMemo(() => isoToday(), []);

  const [quoteNumber] = useState(() => rentalQuoteNumber());
  const [quoteLocale, setQuoteLocale] = useState<RentalQuoteLocale>(
    isHe ? 'he' : 'en'
  );
  const [documentMode, setDocumentMode] =
    useState<RentalDocumentMode>('quote');
  // A rental quotation holds for a month, and the customer's document link
  // expires with this date — so it is the default, not a week.
  const [validUntil, setValidUntil] = useState(() => addIsoDays(today, 30));
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [pickupDate, setPickupDate] = useState(today);
  const [returnDate, setReturnDate] = useState(() => addIsoDays(today, 1));
  const [pickupTime, setPickupTime] = useState('09:00');
  const [returnTime, setReturnTime] = useState('09:00');
  const [pickupLocation, setPickupLocation] = useState('');
  const [returnLocation, setReturnLocation] = useState('');
  const [vehicles, setVehicles] = useState<RentalQuoteVehicle[]>([
    emptyRentalVehicle(),
  ]);
  const [extras, setExtras] = useState<RentalQuoteExtra[]>(() =>
    RENTAL_EXTRA_PRESETS.map((extra) => ({ ...extra }))
  );
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [vatMode, setVatMode] = useState<VatMode>('included');
  const [mileageAllowance, setMileageAllowance] = useState<string>(
    t.defaultMileage
  );
  const [insuranceCoverage, setInsuranceCoverage] = useState('');
  const [deposit, setDeposit] = useState<string>(t.defaultDeposit);
  // Left empty on purpose: the deductible is a concrete amount or condition,
  // and a vague default printed as if it were agreed is worse than a dash.
  const [deductible, setDeductible] = useState('');
  const [fuelPolicy, setFuelPolicy] = useState<string>(t.defaultFuel);
  const [notes, setNotes] = useState('');
  const [inventory, setInventory] = useState<InventoryVehicle[]>([]);
  const [busy, setBusy] = useState<'pdf' | 'whatsapp' | null>(null);
  const [error, setError] = useState('');
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewScale, setPreviewScale] = useState(0.5);

  useLayoutEffect(() => {
    const element = previewWrapRef.current;
    if (!element) return;
    const update = () =>
      setPreviewScale(Math.min(1, element.clientWidth / A4_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/vehicles', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setInventory(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const quoteData: RentalQuoteData = useMemo(
    () => ({
      quoteNumber,
      date: today,
      validUntil,
      locale: quoteLocale,
      documentMode,
      customerName,
      customerPhone,
      customerEmail,
      pickupDate,
      returnDate,
      pickupTime,
      returnTime,
      pickupLocation,
      returnLocation,
      vehicles,
      extras,
      deliveryFee,
      discount,
      vatMode,
      mileageAllowance,
      insuranceCoverage,
      deposit,
      deductible,
      fuelPolicy,
      notes,
    }),
    [
      quoteNumber,
      today,
      validUntil,
      quoteLocale,
      documentMode,
      customerName,
      customerPhone,
      customerEmail,
      pickupDate,
      returnDate,
      pickupTime,
      returnTime,
      pickupLocation,
      returnLocation,
      vehicles,
      extras,
      deliveryFee,
      discount,
      vatMode,
      mileageAllowance,
      insuranceCoverage,
      deposit,
      deductible,
      fuelPolicy,
      notes,
    ]
  );

  const totals = useMemo(
    () => calculateRentalQuoteTotals(quoteData),
    [quoteData]
  );
  const previewShell = useMemo(
    () =>
      `<!doctype html><html lang="${quoteLocale}" dir="${quoteLocale === 'he' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">${rentalQuoteHeadHTML()}</head><body></body></html>`,
    [quoteLocale]
  );
  const previewBody = useMemo(
    () => rentalQuoteBodyHTML(quoteData),
    [quoteData]
  );

  useEffect(() => {
    let animationFrame = 0;
    let cancelled = false;
    const writePreview = () => {
      if (cancelled) return;
      const document = iframeRef.current?.contentDocument;
      if (document?.body && document.head?.querySelector('style')) {
        document.body.innerHTML = previewBody;
        // Same shrink-to-fit the PDF renderer applies, so a four-vehicle
        // document previews exactly as the customer will receive it.
        fitRentalQuoteToPage(document);
      } else {
        animationFrame = requestAnimationFrame(writePreview);
      }
    };
    writePreview();
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
    };
  }, [previewBody, previewShell]);

  const updateVehicle = (
    index: number,
    patch: Partial<RentalQuoteVehicle>
  ) => {
    setVehicles((current) =>
      current.map((vehicle, itemIndex) =>
        itemIndex === index ? { ...vehicle, ...patch } : vehicle
      )
    );
  };

  const fillVehicleFromInventory = (index: number, vehicleId: string) => {
    const inventoryVehicle = inventory.find(
      (vehicle) => vehicle.id === vehicleId
    );
    if (!inventoryVehicle) return;
    updateVehicle(index, {
      name: `${inventoryVehicle.make} ${inventoryVehicle.model}`,
      year: String(inventoryVehicle.year ?? ''),
      category: inventoryVehicle.category ?? '',
      dailyPrice: Number(inventoryVehicle.price_per_day) || 0,
      imageUrl: inventoryVehicle.image_urls?.[0] ?? '',
    });
    if (
      inventoryVehicle.deposit_amount &&
      deposit === t.defaultDeposit
    ) {
      setDeposit(`₪${money(inventoryVehicle.deposit_amount, adminLocale)}`);
    }
    if (
      inventoryVehicle.mileage_limit &&
      mileageAllowance === t.defaultMileage
    ) {
      setMileageAllowance(
        isHe
          ? `${inventoryVehicle.mileage_limit} ק״מ ליום`
          : `${inventoryVehicle.mileage_limit} km per day`
      );
    }
  };

  const updateExtra = (index: number, patch: Partial<RentalQuoteExtra>) => {
    setExtras((current) =>
      current.map((extra, itemIndex) =>
        itemIndex === index ? { ...extra, ...patch } : extra
      )
    );
  };

  const addCustomExtra = () => {
    if (extras.length >= MAX_EXTRAS) return;
    setExtras((current) => [
      ...current,
      {
        id: `custom-${Date.now()}`,
        labelHe: t.customExtraHe,
        labelEn: t.customExtraEn,
        price: 0,
        billing: 'flat',
        quantity: 1,
        selected: true,
      },
    ]);
  };

  const removeExtra = (index: number) => {
    setExtras((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const validateForm = () => {
    const valid = Boolean(
      customerName.trim() &&
        customerPhone.trim() &&
        pickupDate &&
        returnDate &&
        returnDate >= pickupDate &&
        pickupLocation.trim() &&
        returnLocation.trim() &&
        vehicles.some((vehicle) => vehicle.name.trim())
    );
    if (!valid) {
      setError(t.requiredError);
      return false;
    }
    if (!insuranceCoverage.trim()) {
      setError(t.insuranceRequired);
      return false;
    }
    return true;
  };

  const handleExpiredSession = () => {
    setError(t.expired);
    window.setTimeout(() => {
      window.location.href = `/${adminLocale}/admin/login`;
    }, 1_200);
  };

  const requestPdf = async (): Promise<Blob | null> => {
    const response = await fetch('/api/admin/rental-quote-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteData),
    });
    if (response.status === 401) {
      handleExpiredSession();
      return null;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error || t.pdfError);
      return null;
    }
    return response.blob();
  };

  const handleDownload = async () => {
    setError('');
    if (!validateForm()) return;
    setBusy('pdf');
    try {
      const pdf = await requestPdf();
      if (!pdf) return;
      const url = URL.createObjectURL(pdf);
      const anchor = document.createElement('a');
      const customer = customerName.replace(/[^\p{L}\p{N}]+/gu, '_');
      const kind =
        documentMode === 'confirmation'
          ? 'SmartCar_Booking_Confirmation'
          : 'SmartCar_Rental_Quote';
      anchor.href = url;
      anchor.download = `${kind}_${customer || quoteNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError(t.pdfError);
    } finally {
      setBusy(null);
    }
  };

  const handleWhatsApp = async () => {
    setError('');
    if (!validateForm()) return;
    // The customer's link expires with the quotation, so an expired quotation
    // cannot be sent at all. Caught here as well as on the server so nothing
    // is rendered or uploaded first.
    if (validUntil < today) {
      setError(t.validUntilPast);
      return;
    }

    const whatsappWindow = window.open('', '_blank');
    setBusy('whatsapp');
    try {
      const response = await fetch('/api/admin/rental-quote-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteData),
      });
      if (response.status === 401) {
        whatsappWindow?.close();
        handleExpiredSession();
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.whatsappUrl) {
        whatsappWindow?.close();
        setError(body.error || t.whatsappError);
        return;
      }
      if (whatsappWindow) {
        whatsappWindow.opener = null;
        whatsappWindow.location.href = body.whatsappUrl;
      } else {
        window.location.href = body.whatsappUrl;
      }
    } catch {
      whatsappWindow?.close();
      setError(t.whatsappError);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main
      className="mx-auto max-w-[1500px] p-3 sm:p-5"
      dir={isHe ? 'rtl' : 'ltr'}
    >
      <header className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-2xl font-black text-gray-900">{t.pageTitle}</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy !== null}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {busy === 'pdf' ? t.downloading : t.download}
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            disabled={busy !== null}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17a857] px-4 text-sm font-bold text-white transition-colors hover:bg-[#138d4b] disabled:opacity-50"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {busy === 'whatsapp' ? t.preparingWhatsapp : t.whatsapp}
          </button>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Preview — a true A4 page scaled to the column, sticky on desktop so
            the document stays in view while the form below is filled. */}
        {/* min-w-0: without it the grid column cannot shrink below the scaled
            A4 box, and on a phone the box keeps the page wider than the
            viewport instead of the box scaling down to the column. */}
        <aside className="min-w-0 lg:sticky lg:top-4">
          <div className="rounded-2xl bg-gray-200/70 p-2 sm:p-3">
            <div ref={previewWrapRef} className="w-full">
              <div
                dir="ltr"
                className="relative mx-auto overflow-hidden rounded-lg bg-white shadow-2xl"
                style={{
                  width: A4_WIDTH * previewScale,
                  height: A4_HEIGHT * previewScale,
                }}
              >
                <iframe
                  key={quoteLocale}
                  ref={iframeRef}
                  title={t.preview}
                  srcDoc={previewShell}
                  scrolling="no"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: A4_WIDTH,
                    height: A4_HEIGHT,
                    border: 0,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'top left',
                  }}
                />
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-3 lg:max-h-[calc(100vh-7rem)]">
          <section className="rounded-2xl bg-[#0d2b2b] p-3 text-white">
            <h2 className="mb-2 text-sm font-black">{t.priceSummary}</h2>
            <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
              <SummaryItem label={t.rentalDays} value={String(totals.days)} />
              <SummaryItem
                label={t.vehiclesTotal}
                value={`₪${money(totals.vehicles, adminLocale)}`}
              />
              <SummaryItem
                label={t.extrasTotal}
                value={`₪${money(totals.extras, adminLocale)}`}
              />
              <SummaryItem
                label={t.subtotal}
                value={`₪${money(totals.subtotal, adminLocale)}`}
              />
              <SummaryItem
                label={t.vatAmount}
                value={`₪${money(totals.vat, adminLocale)}`}
              />
              <SummaryItem
                label={t.total}
                value={`₪${money(totals.total, adminLocale)}`}
                strong
              />
            </dl>
          </section>

          {/* Only the sections scroll: the totals strip above stays in view,
              so the price is never hidden while the form is being filled. */}
          <div className="min-w-0 space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pe-1">
            <Section title={t.quoteDetails}>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Field label={t.quoteNumber} value={quoteNumber} readOnly />
                <Field label={t.quoteDate} value={today} type="date" readOnly />
                <Field
                  label={t.validUntil}
                  value={validUntil}
                  type="date"
                  min={today}
                  onChange={setValidUntil}
                />
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">
                    {t.outputLanguage}
                  </span>
                  <select
                    value={quoteLocale}
                    onChange={(event) =>
                      setQuoteLocale(event.target.value as RentalQuoteLocale)
                    }
                    className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#2D5F5F]"
                  >
                    <option value="he">{t.hebrew}</option>
                    <option value="en">{t.english}</option>
                  </select>
                </label>
              </div>

              <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <input
                  type="checkbox"
                  checked={documentMode === 'confirmation'}
                  onChange={(event) =>
                    setDocumentMode(
                      event.target.checked ? 'confirmation' : 'quote'
                    )
                  }
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#2D5F5F]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-gray-900">
                    {t.confirmationToggle}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500">
                    {t.confirmationHint}
                  </span>
                </span>
              </label>
            </Section>

            <Section title={t.customer}>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Field
                  label={t.customerName}
                  value={customerName}
                  onChange={setCustomerName}
                  required
                />
                <Field
                  label={t.customerPhone}
                  value={customerPhone}
                  onChange={setCustomerPhone}
                  type="tel"
                  inputMode="tel"
                  required
                />
                <Field
                  label={t.customerEmail}
                  value={customerEmail}
                  onChange={setCustomerEmail}
                  type="email"
                  inputMode="email"
                />
              </div>
            </Section>

            <Section title={t.rental}>
              <datalist id="smartcar-branches">
                {BRANCHES.map((branch) => (
                  <option
                    key={branch.id}
                    value={
                      quoteLocale === 'he'
                        ? `${branch.streetHe}, ${branch.cityHe}`
                        : `${branch.streetEn}, ${branch.cityEn}`
                    }
                  />
                ))}
              </datalist>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Field
                  label={t.pickupDate}
                  value={pickupDate}
                  onChange={(value) => {
                    setPickupDate(value);
                    if (returnDate < value) setReturnDate(value);
                  }}
                  type="date"
                  required
                />
                <Field
                  label={t.returnDate}
                  value={returnDate}
                  min={pickupDate}
                  onChange={setReturnDate}
                  type="date"
                  required
                />
                <Field
                  label={t.pickupTime}
                  value={pickupTime}
                  onChange={setPickupTime}
                  type="time"
                  required
                />
                <Field
                  label={t.returnTime}
                  value={returnTime}
                  onChange={setReturnTime}
                  type="time"
                  required
                />
                {/* A datalist suggests the branches without restricting the
                    value: any address in Israel can be typed in full. */}
                <Field
                  label={t.pickupLocation}
                  value={pickupLocation}
                  onChange={setPickupLocation}
                  list="smartcar-branches"
                  placeholder={t.locationPlaceholder}
                  required
                />
                <Field
                  label={t.returnLocation}
                  value={returnLocation}
                  onChange={setReturnLocation}
                  list="smartcar-branches"
                  placeholder={t.locationPlaceholder}
                  required
                />
              </div>
            </Section>

            <section aria-labelledby="rental-vehicles-heading">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2
                  id="rental-vehicles-heading"
                  className="font-black text-gray-900"
                >
                  {t.vehicles}
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setVehicles((current) => [
                      ...current,
                      emptyRentalVehicle(),
                    ])
                  }
                  disabled={vehicles.length >= MAX_VEHICLES}
                  className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold text-[#2D5F5F] hover:bg-[#edf5f4] disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t.addVehicle}
                </button>
              </div>

              <div className="space-y-3">
                {vehicles.map((vehicle, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="truncate font-bold text-gray-900">
                        {vehicle.name || `${t.vehicle} ${index + 1}`}
                      </h3>
                      {vehicles.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setVehicles((current) =>
                              current.filter(
                                (_, itemIndex) => itemIndex !== index
                              )
                            )
                          }
                          aria-label={`${t.removeVehicle} ${index + 1}`}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>

                    <label className="mb-2.5 block">
                      <span className="mb-1 block text-xs font-medium text-gray-600">
                        {t.inventory}
                      </span>
                      <select
                        defaultValue=""
                        onChange={(event) =>
                          fillVehicleFromInventory(index, event.target.value)
                        }
                        className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#2D5F5F]"
                      >
                        <option value="">{t.manual}</option>
                        {inventory.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.make} {item.model} {item.year}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <Field
                        label={t.vehicleName}
                        value={vehicle.name}
                        onChange={(value) =>
                          updateVehicle(index, { name: value })
                        }
                        required
                      />
                      <Field
                        label={t.category}
                        value={vehicle.category}
                        onChange={(value) =>
                          updateVehicle(index, { category: value })
                        }
                      />
                      <Field
                        label={t.year}
                        value={vehicle.year}
                        onChange={(value) =>
                          updateVehicle(index, { year: value })
                        }
                      />
                      <Field
                        label={t.dailyPrice}
                        value={String(vehicle.dailyPrice)}
                        onChange={(value) =>
                          updateVehicle(index, {
                            dailyPrice: Number(value) || 0,
                          })
                        }
                        type="number"
                        inputMode="decimal"
                        min="0"
                      />
                      <Field
                        label={t.quantity}
                        value={String(vehicle.quantity)}
                        onChange={(value) =>
                          updateVehicle(index, {
                            quantity: Math.max(1, Number(value) || 1),
                          })
                        }
                        type="number"
                        inputMode="numeric"
                        min="1"
                      />
                      <Field
                        label={t.imageUrl}
                        value={vehicle.imageUrl}
                        onChange={(value) =>
                          updateVehicle(index, { imageUrl: value })
                        }
                        dir="ltr"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="rental-extras-heading">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2
                  id="rental-extras-heading"
                  className="font-black text-gray-900"
                >
                  {t.extras}
                </h2>
                <button
                  type="button"
                  onClick={addCustomExtra}
                  disabled={extras.length >= MAX_EXTRAS}
                  className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold text-[#2D5F5F] hover:bg-[#edf5f4] disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t.addExtra}
                </button>
              </div>

              <div className="space-y-2.5">
                {extras.map((extra, index) => (
                  <div
                    key={extra.id}
                    className={`rounded-2xl border bg-white p-3 transition-colors ${
                      extra.selected
                        ? 'border-[#86aaa5] shadow-sm'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold text-gray-800">
                        <input
                          type="checkbox"
                          checked={extra.selected}
                          onChange={(event) =>
                            updateExtra(index, { selected: event.target.checked })
                          }
                          aria-label={`${t.selected}: ${
                            quoteLocale === 'he' ? extra.labelHe : extra.labelEn
                          }`}
                          className="h-5 w-5 accent-[#2D5F5F]"
                        />
                        {quoteLocale === 'he' ? extra.labelHe : extra.labelEn}
                      </label>
                      {!RENTAL_EXTRA_PRESETS.some(
                        (preset) => preset.id === extra.id
                      ) ? (
                        <button
                          type="button"
                          onClick={() => removeExtra(index)}
                          aria-label={t.removeExtra}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <Field
                        label={t.extraNameHe}
                        value={extra.labelHe}
                        onChange={(value) =>
                          updateExtra(index, { labelHe: value })
                        }
                      />
                      <Field
                        label={t.extraNameEn}
                        value={extra.labelEn}
                        onChange={(value) =>
                          updateExtra(index, { labelEn: value })
                        }
                        dir="ltr"
                      />
                      <Field
                        label={t.price}
                        value={String(extra.price)}
                        onChange={(value) =>
                          updateExtra(index, { price: Number(value) || 0 })
                        }
                        type="number"
                        inputMode="decimal"
                        min="0"
                      />
                      <Field
                        label={t.quantity}
                        value={String(extra.quantity)}
                        onChange={(value) =>
                          updateExtra(index, {
                            quantity: Math.max(1, Number(value) || 1),
                          })
                        }
                        type="number"
                        inputMode="numeric"
                        min="1"
                      />
                      <label className="block sm:col-span-2">
                        <span className="mb-1 block text-xs font-medium text-gray-600">
                          {t.billing}
                        </span>
                        <select
                          value={extra.billing}
                          onChange={(event) =>
                            updateExtra(index, {
                              billing: event.target.value as ExtraBilling,
                            })
                          }
                          className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#2D5F5F]"
                        >
                          <option value="day">{t.perDay}</option>
                          <option value="flat">{t.flat}</option>
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <Section title={t.termsAndPrice}>
              <datalist id="rental-insurance-options">
                {INSURANCE_SUGGESTIONS[quoteLocale].map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Field
                  label={t.insurance}
                  value={insuranceCoverage}
                  onChange={setInsuranceCoverage}
                  list="rental-insurance-options"
                  hint={t.insuranceHint}
                  required
                />
                <Field
                  label={t.deductible}
                  value={deductible}
                  onChange={setDeductible}
                  placeholder={t.deductiblePlaceholder}
                />
                <Field
                  label={t.mileage}
                  value={mileageAllowance}
                  onChange={setMileageAllowance}
                />
                <Field
                  label={t.deposit}
                  value={deposit}
                  onChange={setDeposit}
                />
                <Field
                  label={t.fuelPolicy}
                  value={fuelPolicy}
                  onChange={setFuelPolicy}
                />
                <Field
                  label={t.deliveryFee}
                  value={String(deliveryFee)}
                  onChange={(value) => setDeliveryFee(Number(value) || 0)}
                  type="number"
                  inputMode="decimal"
                  min="0"
                />
                <Field
                  label={t.discount}
                  value={String(discount)}
                  onChange={(value) => setDiscount(Number(value) || 0)}
                  type="number"
                  inputMode="decimal"
                  min="0"
                />
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">
                    {t.vat}
                  </span>
                  <select
                    value={vatMode}
                    onChange={(event) =>
                      setVatMode(event.target.value as VatMode)
                    }
                    className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#2D5F5F]"
                  >
                    <option value="included">{t.vatIncluded}</option>
                    <option value="excluded">{t.vatExcluded}</option>
                    <option value="not_applicable">
                      {t.vatNotApplicable}
                    </option>
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-gray-600">
                    {t.notes}
                  </span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#2D5F5F]"
                  />
                </label>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
      <h2 className="mb-2 font-black text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  readOnly = false,
  required = false,
  inputMode,
  min,
  list,
  dir,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  readOnly?: boolean;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  min?: string;
  list?: string;
  dir?: 'ltr' | 'rtl';
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        required={required}
        inputMode={inputMode}
        min={min}
        list={list}
        // A time input inherits the form's RTL direction and renders 09:00 as
        // 00:09. The field's own direction is LTR; the label and the rest of the
        // form stay as they are.
        dir={dir ?? (type === 'time' ? 'ltr' : undefined)}
        placeholder={placeholder}
        className={`min-h-11 w-full rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-[#2D5F5F] ${
          readOnly
            ? 'border-gray-200 bg-gray-50 text-gray-500'
            : 'border-gray-300 bg-white'
        }`}
      />
      {hint ? (
        <span className="mt-1 block text-[11px] text-gray-500">{hint}</span>
      ) : null}
    </label>
  );
}

function SummaryItem({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] text-[#b7cbc7]">{label}</dt>
      <dd
        className={
          strong
            ? 'mt-0.5 text-lg font-black text-[#f3a466]'
            : 'mt-0.5 text-sm font-bold'
        }
      >
        {value}
      </dd>
    </div>
  );
}
