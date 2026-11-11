'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AlertCircle, Camera, Check, ChevronLeft, ChevronRight, ImageIcon, Lock, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { OFFICE_PHONE } from '@/lib/constants';
import { isValidIdOf } from '@/lib/accident-report/schema';
import { cardBrand, BRAND_LABEL, digitsOnly, expiryValid, formatCardNumber, luhnValid } from '@/lib/customer-verification/card';

type Lang = 'he' | 'en';

/**
 * CVV field: off unless NEXT_PUBLIC_CV_COLLECT_CVV=1. Even when on, the
 * value is only sent once to the provider check on the server and never
 * stored (see src/lib/customer-verification/provider.ts).
 */
const COLLECT_CVV = process.env.NEXT_PUBLIC_CV_COLLECT_CVV === '1';

const T = {
  he: {
    loading: 'טוען…',
    invalidTitle: 'הקישור הזה כבר לא פעיל',
    invalidBody: 'ייתכן שהפרטים כבר נשלחו, או שעברו 3 ימים מאז שהקישור נשלח. המשרד ישלח לכם קישור חדש.',
    call: 'התקשרות למשרד',
    hello: (n: string) => (n ? `שלום ${n}` : 'שלום'),
    stepLicense: 'רישיון נהיגה',
    stepCard: 'כרטיס אשראי',
    licenseTitle: 'צלמו את רישיון הנהיגה',
    licenseHint: 'שני הצדדים, על משטח ישר ובאור טוב, כך שכל הפרטים קריאים.',
    front: 'צד קדמי',
    back: 'צד אחורי',
    shot: 'צולם',
    tapToShoot: 'הקישו לצילום',
    fromGallery: 'בחירה מהגלריה',
    retake: 'צילום מחדש',
    uploading: 'מעלה את התמונה…',
    uploadFailed: 'התמונה לא עלתה. בדקו את החיבור וצלמו שוב.',
    needBoth: 'חסר צילום של אחד מצדי הרישיון',
    next: 'המשך לפרטי הכרטיס',
    back_: 'חזרה',
    cardTitle: 'פרטי כרטיס האשראי',
    cardHint: 'הכרטיס משמש לחיובים שמגיעים אחרי ההשכרה, כמו כביש 6 ודוחות, לפי הסכם השכירות.',
    cardNumber: 'מספר כרטיס',
    expiry: 'תוקף',
    cvv: 'CVV',
    cvvHint: '3 ספרות בגב',
    holderId: 'ת״ז בעל הכרטיס',
    holderPassport: 'דרכון בעל הכרטיס',
    foreignCard: 'בעל הכרטיס אינו תושב ישראל',
    consent:
      'אני מאשר/ת לסמארט קאר לשמור את פרטי הכרטיס באופן מאובטח ולחייב אותו בגין אגרות כביש 6, דוחות תנועה וחניה, קנסות ונזקים שמקורם בתקופת השכירות, בהתאם להסכם השכירות.',
    errCard: 'מספר הכרטיס לא תקין. בדקו שהקלדתם את כל הספרות.',
    errExpiry: 'התוקף לא תקין או שעבר. כתבו חודש ושנה, למשל 08/28.',
    errCvv: 'כתבו את 3 הספרות שבגב הכרטיס',
    errId: 'מספר הזהות לא תקין. כתבו 9 ספרות, כולל ספרת ביקורת.',
    errPassport: 'מספר הדרכון לא תקין',
    errConsent: 'כדי להמשיך יש לאשר את שמירת הכרטיס והחיוב',
    errDeclined: 'חברת האשראי לא אישרה את הכרטיס. בדקו את הפרטים או נסו כרטיס אחר.',
    submit: 'שליחת הפרטים',
    sending: 'שולח…',
    submitFailed: 'הפרטים לא נשלחו. בדקו את החיבור ונסו שוב.',
    doneTitle: 'הפרטים התקבלו',
    doneBody: 'הרישיון והכרטיס שמורים אצלנו. אין צורך לעשות שום דבר נוסף, נתראה באיסוף.',
    ref: 'מספר אסמכתה',
    secure: 'הפרטים נשמרים מוצפנים',
    steps: 'שלבים',
    lang: 'English',
  },
  en: {
    loading: 'Loading…',
    invalidTitle: 'This link is no longer active',
    invalidBody: 'The details may already have been sent, or 3 days have passed since the link was sent. The office will send you a new one.',
    call: 'Call the office',
    hello: (n: string) => (n ? `Hi ${n}` : 'Hi'),
    stepLicense: 'Driving licence',
    stepCard: 'Credit card',
    licenseTitle: 'Photograph your driving licence',
    licenseHint: 'Both sides, on a flat surface in good light, with every detail readable.',
    front: 'Front',
    back: 'Back',
    shot: 'Done',
    tapToShoot: 'Tap to take a photo',
    fromGallery: 'Choose from gallery',
    retake: 'Retake',
    uploading: 'Uploading photo…',
    uploadFailed: 'The photo did not upload. Check your connection and try again.',
    needBoth: 'One side of the licence is missing',
    next: 'Continue to card details',
    back_: 'Back',
    cardTitle: 'Credit card details',
    cardHint: 'The card covers charges that arrive after the rental, such as Route 6 tolls and fines, as set out in the rental agreement.',
    cardNumber: 'Card number',
    expiry: 'Expiry',
    cvv: 'CVV',
    cvvHint: '3 digits on the back',
    holderId: 'Cardholder Israeli ID',
    holderPassport: 'Cardholder passport',
    foreignCard: 'The cardholder is not an Israeli resident',
    consent:
      'I authorise SmartCar to store the card details securely and to charge the card for Route 6 tolls, traffic and parking tickets, fines and damage arising from the rental period, as set out in the rental agreement.',
    errCard: 'The card number is not valid. Check that every digit is there.',
    errExpiry: 'The expiry is invalid or has passed. Use month and year, e.g. 08/28.',
    errCvv: 'Enter the 3 digits on the back of the card',
    errId: 'The ID number is not valid. Use all 9 digits, including the check digit.',
    errPassport: 'The passport number is not valid',
    errConsent: 'To continue, confirm card storage and charging',
    errDeclined: 'The card was not approved. Check the details or try another card.',
    submit: 'Send details',
    sending: 'Sending…',
    submitFailed: 'The details were not sent. Check your connection and try again.',
    doneTitle: 'Details received',
    doneBody: 'Your licence and card are on file. There is nothing else to do. See you at pickup.',
    ref: 'Reference',
    secure: 'Details are stored encrypted',
    steps: 'Steps',
    lang: 'עברית',
  },
} as const;

interface Upload { path: string; preview: string }

async function compress(file: File, max: number, quality: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', quality));
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

const field = (err?: string) =>
  `h-[58px] w-full rounded-2xl border-2 bg-white px-4 text-[19px] text-[#14282A] outline-none transition-colors placeholder:text-[#A7B8B9] focus:border-[#2D5F5F] ${
    err ? 'border-[#B42318] bg-[#FFF6F5]' : 'border-[#DCE5E5]'
  }`;

function Err({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="flex items-start gap-1.5 text-[15px] font-medium leading-snug text-[#B42318]">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      {msg}
    </p>
  );
}

export default function VerificationForm({ locale, token }: { locale: Lang; token?: string }) {
  const [L, setL] = useState<Lang>(locale);
  const t = T[L];
  const dir = L === 'he' ? 'rtl' : 'ltr';
  const BackIcon = L === 'he' ? ChevronRight : ChevronLeft;

  const [state, setState] = useState<'loading' | 'invalid' | 'form' | 'done'>(token ? 'loading' : 'invalid');
  const [name, setName] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [front, setFront] = useState<Upload | null>(null);
  const [back, setBack] = useState<Upload | null>(null);
  const [busySide, setBusySide] = useState<'front' | 'back' | null>(null);
  const [uploadErr, setUploadErr] = useState('');
  const [card, setCard] = useState('');
  const [exp, setExp] = useState('');
  const [cvv, setCvv] = useState('');
  const [cvvFocus, setCvvFocus] = useState(false);
  const [foreign, setForeign] = useState(false);
  const [holderId, setHolderId] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  const [refId, setRefId] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const expRef = useRef<HTMLInputElement>(null);
  const cvvRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/customer-verification/link?t=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.valid) { setName(d.name ?? ''); setState('form'); } else setState('invalid');
      })
      .catch(() => { if (!cancelled) setState('invalid'); });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (state === 'loading') return;
    headingRef.current?.focus({ preventScroll: true });
    document.getElementById('cv-scroll')?.scrollTo(0, 0);
  }, [step, state]);

  const clear = (k: string) => setErrors((x) => (x[k] ? { ...x, [k]: '' } : x));

  const upload = async (file: File | undefined, side: 'front' | 'back') => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploadErr('');
    setBusySide(side);
    try {
      const [full, small] = await Promise.all([compress(file, 2000, 0.85), compress(file, 900, 0.75)]);
      const res = await fetch('/api/customer-verification/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, side, contentType: 'image/jpeg' }),
      });
      if (res.status === 410) { setState('invalid'); return; }
      if (!res.ok) throw new Error('url');
      const { path, token: uploadToken } = await res.json();
      const { error } = await createClient().storage.from('customer-verifications').uploadToSignedUrl(path, uploadToken, full, { contentType: 'image/jpeg' });
      if (error) throw error;
      (side === 'front' ? setFront : setBack)({ path, preview: URL.createObjectURL(small) });
      clear('license');
    } catch {
      setUploadErr(t.uploadFailed);
    } finally {
      setBusySide(null);
    }
  };

  const expParts = () => {
    const d = digitsOnly(exp);
    return { m: d.slice(0, 2), y: d.slice(2, 4) };
  };

  const validateCard = () => {
    const e: Record<string, string> = {};
    if (!luhnValid(card)) e.card = t.errCard;
    const { m, y } = expParts();
    if (!expiryValid(m, y)) e.exp = t.errExpiry;
    if (COLLECT_CVV && !/^\d{3,4}$/.test(cvv)) e.cvv = t.errCvv;
    if (!isValidIdOf(foreign ? 'passport' : 'il', holderId)) e.id = foreign ? t.errPassport : t.errId;
    if (!consent) e.consent = t.errConsent;
    setErrors(e);
    const first = ['card', 'exp', 'cvv', 'id', 'consent'].find((k) => e[k]);
    if (first) document.getElementById(`cv-${first}`)?.focus();
    return !first;
  };

  const submit = async () => {
    setSubmitErr('');
    if (!validateCard()) return;
    setSending(true);
    try {
      const { m, y } = expParts();
      const res = await fetch('/api/customer-verification/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          t: token,
          licenseFront: front?.path,
          licenseBack: back?.path,
          cardNumber: digitsOnly(card),
          expMonth: m,
          expYear: y,
          ...(COLLECT_CVV ? { cvv } : {}),
          holderIdType: foreign ? 'passport' : 'il',
          holderId,
          consent,
        }),
      });
      if (res.status === 410) { setState('invalid'); return; }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (d.fields?.includes('license')) { setStep(1); setErrors({ license: t.needBoth }); return; }
        if (d.fields?.includes('cardDeclined')) { setSubmitErr(t.errDeclined); return; }
        setSubmitErr(t.submitFailed);
        return;
      }
      setCard(''); setExp(''); setCvv(''); setHolderId('');
      setRefId(d.id ?? '');
      setState('done');
    } catch {
      setSubmitErr(t.submitFailed);
    } finally {
      setSending(false);
    }
  };

  /* ---------------- shared pieces (render helpers, not components) ---------------- */

  const langBtn = (
    <button type="button" onClick={() => setL(L === 'he' ? 'en' : 'he')}
      className="min-h-11 min-w-11 rounded-full px-3 text-[15px] font-semibold text-[#2D5F5F] active:bg-[#E6EFEF]">
      {t.lang}
    </button>
  );

  const logo = (cls = 'h-[24px]') => (
    <Image src="/images/logo.png" alt="SmartCar" width={90} height={30} className={`${cls} w-auto`} style={{ width: 'auto' }} priority />
  );

  const shell = (children: React.ReactNode) => (
    <div id="cv-scroll" dir={dir} lang={L} className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-[#F4F7F7] text-[#14282A]">
      <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col">{children}</div>
    </div>
  );

  const topBar = () => (
    <div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[#E3EAEA] bg-white/95 px-3 backdrop-blur">
      {state === 'form' && step === 2 ? (
        <button type="button" onClick={() => setStep(1)} className="flex min-h-11 min-w-11 items-center gap-0.5 rounded-full pe-3 ps-1 text-[15px] font-semibold text-[#2D5F5F] active:bg-[#E6EFEF]">
          <BackIcon className="h-5 w-5" aria-hidden />{t.back_}
        </button>
      ) : <span className="min-w-11" />}
      {logo()}
      {langBtn}
    </div>
  );

  // The two stages of the task, as a real sequence.
  const stepper = () => (
    <ol className="flex items-center gap-2 px-5 pt-5" aria-label={t.steps}>
      {[t.stepLicense, t.stepCard].map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className={`flex items-center gap-2 ${i === 0 ? 'flex-1' : ''}`} aria-current={current ? 'step' : undefined}>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold ${
              done ? 'bg-[#2D5F5F] text-white' : current ? 'bg-[#0D2B2B] text-white' : 'bg-[#DCE5E5] text-[#5B7072]'
            }`}>
              {done ? <Check className="h-4 w-4" aria-hidden /> : n}
            </span>
            <span className={`whitespace-nowrap text-[14px] ${current ? 'font-bold text-[#0D2B2B]' : 'text-[#5B7072]'}`}>{label}</span>
            {i === 0 && <span className={`mx-1 h-[2px] flex-1 rounded-full ${step > 1 ? 'bg-[#2D5F5F]' : 'bg-[#DCE5E5]'}`} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );

  const heading = (title: string, hint: string) => (
    <div className="px-5 pb-1 pt-6">
      {step === 1 && <p className="mb-1 text-[17px] text-[#4A6264]">{t.hello(name)},</p>}
      <h1 ref={headingRef} tabIndex={-1} className="text-[28px] font-extrabold leading-[1.15] tracking-[-0.01em] text-[#0D2B2B] outline-none">{title}</h1>
      <p className="mt-2 text-[16px] leading-relaxed text-[#4A6264]">{hint}</p>
    </div>
  );

  const footer = (children: React.ReactNode) => (
    <div className="sticky bottom-0 z-10 mt-auto border-t border-[#E3EAEA] bg-white/95 px-5 pb-[max(env(safe-area-inset-bottom),16px)] pt-3 backdrop-blur">
      {children}
      <p className="mt-2 flex items-center justify-center gap-1.5 text-[13px] text-[#5B7072]"><Lock className="h-3.5 w-3.5" aria-hidden />{t.secure}</p>
    </div>
  );

  const mainBtn = 'flex h-[58px] w-full items-center justify-center gap-2 rounded-2xl bg-[#E8743B] text-[18px] font-bold text-white shadow-[0_6px_16px_rgba(232,116,59,0.35)] transition active:scale-[0.99] active:bg-[#D9652D] disabled:opacity-60 disabled:shadow-none';

  /* ---------------- states ---------------- */

  if (state === 'loading') {
    return shell(<div className="flex flex-1 items-center justify-center p-10 text-[#4A6264]" role="status">{t.loading}</div>);
  }

  if (state === 'invalid') {
    return shell(
      <>
        {topBar()}
        <div className="flex flex-1 flex-col items-center px-6 pt-16 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF1E5]"><AlertCircle className="h-10 w-10 text-[#C2541C]" aria-hidden /></div>
          <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-[26px] font-extrabold text-[#0D2B2B] outline-none">{t.invalidTitle}</h1>
          <p className="mt-3 max-w-[340px] text-[17px] leading-relaxed text-[#33494B]">{t.invalidBody}</p>
          <a href={`tel:${OFFICE_PHONE}`} className="mt-8 flex h-[58px] w-full max-w-[340px] items-center justify-center rounded-2xl border-2 border-[#2D5F5F] text-[17px] font-bold text-[#2D5F5F] active:bg-[#E6EFEF]">
            {t.call} <span dir="ltr" className="ms-2 font-semibold">{OFFICE_PHONE}</span>
          </a>
        </div>
      </>,
    );
  }

  if (state === 'done') {
    return shell(
      <>
        {topBar()}
        <div className="flex flex-1 flex-col items-center px-6 pt-14 text-center">
          <div className="cv-pop flex h-24 w-24 items-center justify-center rounded-full bg-[#2D5F5F]"><Check className="h-12 w-12 text-white" strokeWidth={3} aria-hidden /></div>
          <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-[30px] font-extrabold text-[#0D2B2B] outline-none">{t.doneTitle}</h1>
          <p className="mt-3 max-w-[340px] text-[17px] leading-relaxed text-[#33494B]">{t.doneBody}</p>
          {refId && (
            <div className="mt-8 w-full max-w-[300px] rounded-2xl bg-white px-5 py-4 ring-1 ring-black/[0.05]">
              <div className="text-[14px] text-[#5B7072]">{t.ref}</div>
              <div dir="ltr" className="mt-1 text-[24px] font-bold tabular-nums tracking-wide text-[#0D2B2B]">{refId}</div>
            </div>
          )}
          <p className="mt-8 flex items-center gap-1.5 text-[13px] text-[#5B7072]"><Lock className="h-3.5 w-3.5" aria-hidden />{t.secure}</p>
        </div>
        <style>{`@keyframes cvpop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}.cv-pop{animation:cvpop .45s ease-out both}@media (prefers-reduced-motion:reduce){.cv-pop{animation:none}}`}</style>
      </>,
    );
  }

  /* ---------------- step 1: licence ---------------- */

  // A slot shaped like the licence itself (ID-1 card, 85.6 × 54 mm) with
  // camera-viewfinder corners: tapping it opens the rear camera.
  const slot = (side: 'front' | 'back', value: Upload | null) => {
    const label = side === 'front' ? t.front : t.back;
    const busy = busySide === side;
    const inputId = `cv-file-${side}`;
    const rtl = dir === 'rtl';
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between px-1">
          <span className="text-[16px] font-bold text-[#0D2B2B]">{label}</span>
          {value && !busy && <span className="flex items-center gap-1 text-[14px] font-semibold text-[#1E7A46]"><Check className="h-4 w-4" aria-hidden />{t.shot}</span>}
        </div>
        <label htmlFor={inputId}
          className={`relative block aspect-[1.586] w-full cursor-pointer overflow-hidden rounded-[18px] transition active:scale-[0.995] ${
            value ? 'bg-[#0D2B2B]' : 'bg-[#E9F1F1]'
          } ${errors.license && !value ? 'ring-2 ring-[#B42318]' : ''}`}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.preview} alt={label} className="h-full w-full object-cover" />
          ) : (
            <>
              {/* licence silhouette: photo box and text lines */}
              <svg viewBox="0 0 856 540" className="absolute inset-0 h-full w-full" aria-hidden>
                <rect x={rtl ? 600 : 76} y="150" width="180" height="230" rx="18" fill="#D3E3E3" />
                {[170, 230, 290, 350].map((y, i) => (
                  <rect key={y} x={rtl ? 540 - (420 - i * 60) : 300} y={y} width={420 - i * 60} height="22" rx="11" fill="#D3E3E3" />
                ))}
              </svg>
              {/* viewfinder corners */}
              {['top-4 start-4 border-t-[3px] border-s-[3px] rounded-ss-xl', 'top-4 end-4 border-t-[3px] border-e-[3px] rounded-se-xl',
                'bottom-4 start-4 border-b-[3px] border-s-[3px] rounded-es-xl', 'bottom-4 end-4 border-b-[3px] border-e-[3px] rounded-ee-xl'].map((c) => (
                <span key={c} className={`absolute h-7 w-7 border-[#2D5F5F] ${c}`} aria-hidden />
              ))}
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2D5F5F] shadow-[0_6px_14px_rgba(45,95,95,0.35)]">
                  <Camera className="h-7 w-7 text-white" aria-hidden />
                </span>
                <span className="rounded-full bg-white/90 px-3 py-1 text-[15px] font-bold text-[#0D2B2B]">{t.tapToShoot}</span>
              </span>
            </>
          )}
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center bg-[#0D2B2B]/70 text-[16px] font-semibold text-white" role="status">
              <span className="me-2 h-5 w-5 animate-spin rounded-full border-[3px] border-white/40 border-t-white" aria-hidden />{t.uploading}
            </span>
          )}
          <input id={inputId} type="file" accept="image/*" capture="environment" className="sr-only"
            aria-label={`${label}: ${t.tapToShoot}`}
            onChange={(e) => { upload(e.target.files?.[0], side); e.target.value = ''; }} />
        </label>
        <div className="flex justify-center">
          <label className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold text-[#2D5F5F] active:bg-[#E6EFEF]">
            {value ? <RotateCcw className="h-4 w-4" aria-hidden /> : <ImageIcon className="h-4 w-4" aria-hidden />}
            {value ? t.retake : t.fromGallery}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { upload(e.target.files?.[0], side); e.target.value = ''; }} />
          </label>
        </div>
      </div>
    );
  };

  if (step === 1) {
    return shell(
      <>
        {topBar()}
        {stepper()}
        {heading(t.licenseTitle, t.licenseHint)}
        <div className="flex flex-col gap-4 px-5 pb-6 pt-4">
          {slot('front', front)}
          {slot('back', back)}
          <Err id="cv-license" msg={uploadErr || errors.license} />
        </div>
        {footer(
          <button type="button" disabled={busySide !== null}
            onClick={() => {
              if (!front || !back) { setErrors({ license: t.needBoth }); return; }
              setErrors({}); setStep(2);
            }}
            className={mainBtn}>
            {t.next}
          </button>,
        )}
      </>,
    );
  }

  /* ---------------- step 2: card ---------------- */

  const digits = digitsOnly(card);
  const brand = digits.length >= 2 ? cardBrand(card) : null;
  const shownNumber = (digits + '•'.repeat(Math.max(0, 16 - digits.length))).replace(/(.{4})(?=.)/g, '$1 ');
  const flipped = COLLECT_CVV && cvvFocus;

  // The one bold element: a SmartCar card that fills in as the customer types.
  const cardPreview = (
    <div className="px-5 pt-5 [perspective:1200px]" aria-hidden>
      <div className={`relative mx-auto aspect-[1.586] w-full max-w-[400px] transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
        <div dir="ltr" className="absolute inset-0 overflow-hidden rounded-[20px] bg-[#0D2B2B] p-5 text-white shadow-[0_14px_30px_rgba(13,43,43,0.35)] [backface-visibility:hidden]">
          {/* a single road sweeping across the card, with its lane markings */}
          <svg viewBox="0 0 400 252" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
            <path d="M-20 238 C 130 214, 220 120, 420 46" stroke="#1F4A4A" strokeWidth="54" fill="none" />
            <path d="M-20 238 C 130 214, 220 120, 420 46" stroke="#B8D8D8" strokeWidth="2.5" strokeDasharray="14 12" fill="none" opacity="0.6" />
          </svg>
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[17px] font-extrabold tracking-tight">SmartCar</span>
              <span className="text-[15px] font-bold">{brand && brand !== 'other' ? BRAND_LABEL[brand] : ''}</span>
            </div>
            <div className="h-8 w-11 rounded-md bg-[#D9C48A]" />
            <div className="whitespace-nowrap text-[clamp(18px,5.8vw,24px)] font-semibold tabular-nums tracking-[0.06em]">{shownNumber}</div>
            <div className="flex items-end justify-between">
              <span className="max-w-[60%] truncate text-[14px] opacity-80">{name}</span>
              <span className={`text-[16px] font-semibold tabular-nums ${exp ? '' : 'opacity-50'}`}>{exp || 'MM/YY'}</span>
            </div>
          </div>
        </div>
        {COLLECT_CVV && (
          <div dir="ltr" className="absolute inset-0 overflow-hidden rounded-[20px] bg-[#0D2B2B] text-white shadow-[0_14px_30px_rgba(13,43,43,0.35)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="mt-7 h-11 bg-[#071A1A]" />
            <div className="mx-5 mt-5 flex h-10 items-center justify-end rounded-md bg-[#E9F1F1] px-3 text-[18px] font-bold tabular-nums tracking-[0.2em] text-[#0D2B2B]">
              {cvv.padEnd(3, '•')}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return shell(
    <>
      {topBar()}
      {stepper()}
      {heading(t.cardTitle, t.cardHint)}
      {cardPreview}
      <div className="flex flex-col gap-5 px-5 pb-6 pt-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="cv-card" className="px-1 text-[16px] font-bold text-[#0D2B2B]">{t.cardNumber}</label>
          <input id="cv-card" dir="ltr" inputMode="numeric" autoComplete="cc-number" enterKeyHint="next" placeholder="0000 0000 0000 0000"
            value={formatCardNumber(card)} aria-invalid={!!errors.card} aria-describedby={errors.card ? 'cv-card-err' : undefined}
            onChange={(e) => {
              const d = digitsOnly(e.target.value).slice(0, 19);
              setCard(d); clear('card');
              if (d.length === 16 && luhnValid(d)) expRef.current?.focus();
            }}
            className={`${field(errors.card)} tabular-nums tracking-[0.04em]`} />
          <Err id="cv-card-err" msg={errors.card} />
        </div>

        <div className="flex flex-col gap-2">
          <div className={`grid gap-3 ${COLLECT_CVV ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div className="flex flex-col gap-2">
              <label htmlFor="cv-exp" className="px-1 text-[16px] font-bold text-[#0D2B2B]">{t.expiry}</label>
              <input id="cv-exp" ref={expRef} dir="ltr" inputMode="numeric" autoComplete="cc-exp" enterKeyHint="next" placeholder="MM/YY" maxLength={5}
                value={exp} aria-invalid={!!errors.exp} aria-describedby={errors.exp ? 'cv-exp-err' : undefined}
                onChange={(e) => {
                  const d = digitsOnly(e.target.value).slice(0, 4);
                  setExp(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d); clear('exp');
                  if (d.length === 4) (COLLECT_CVV ? cvvRef : idRef).current?.focus();
                }}
                className={`${field(errors.exp)} tabular-nums ${COLLECT_CVV ? '' : 'max-w-[200px]'}`} />
            </div>
            {COLLECT_CVV && (
              <div className="flex flex-col gap-2">
                <label htmlFor="cv-cvv" className="px-1 text-[16px] font-bold text-[#0D2B2B]">{t.cvv} <span className="text-[13px] font-normal text-[#5B7072]">{t.cvvHint}</span></label>
                <input id="cv-cvv" ref={cvvRef} dir="ltr" inputMode="numeric" autoComplete="cc-csc" enterKeyHint="next" placeholder="•••" maxLength={4}
                  value={cvv} aria-invalid={!!errors.cvv}
                  onFocus={() => setCvvFocus(true)} onBlur={() => setCvvFocus(false)}
                  onChange={(e) => {
                    const d = digitsOnly(e.target.value).slice(0, 4);
                    setCvv(d); clear('cvv');
                    if (d.length === 3 && !/^3[47]/.test(digits)) idRef.current?.focus();
                  }}
                  className={`${field(errors.cvv)} tabular-nums`} />
              </div>
            )}
          </div>
          <Err id="cv-exp-err" msg={errors.exp || errors.cvv} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="cv-id" className="px-1 text-[16px] font-bold text-[#0D2B2B]">{foreign ? t.holderPassport : t.holderId}</label>
          <input id="cv-id" ref={idRef} dir="ltr" inputMode={foreign ? 'text' : 'numeric'} autoComplete="off" enterKeyHint="done"
            value={holderId} aria-invalid={!!errors.id} aria-describedby={errors.id ? 'cv-id-err' : undefined}
            onChange={(e) => { setHolderId(e.target.value.slice(0, 20)); clear('id'); }}
            className={`${field(errors.id)} tabular-nums`} />
          <Err id="cv-id-err" msg={errors.id} />
          <label className="flex min-h-12 cursor-pointer items-center gap-3 px-1 text-[15px] text-[#33494B]">
            <input type="checkbox" checked={foreign} onChange={(e) => { setForeign(e.target.checked); clear('id'); }} className="h-6 w-6 shrink-0 accent-[#2D5F5F]" />
            {t.foreignCard}
          </label>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="cv-consent" className={`flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 text-[15px] leading-relaxed text-[#33494B] ring-1 transition ${
            errors.consent ? 'ring-2 ring-[#B42318]' : consent ? 'ring-2 ring-[#2D5F5F]' : 'ring-black/[0.06]'
          }`}>
            <input id="cv-consent" type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); clear('consent'); }}
              className="mt-0.5 h-6 w-6 shrink-0 accent-[#2D5F5F]" />
            <span>{t.consent}</span>
          </label>
          <Err id="cv-consent-err" msg={errors.consent} />
        </div>
        <Err id="cv-submit-err" msg={submitErr} />
      </div>
      {footer(
        <button type="button" onClick={submit} disabled={sending} className={mainBtn}>
          {sending
            ? <><span className="h-5 w-5 animate-spin rounded-full border-[3px] border-white/40 border-t-white" aria-hidden />{t.sending}</>
            : <><Lock className="h-5 w-5" aria-hidden />{t.submit}</>}
        </button>,
      )}
    </>,
  );
}
