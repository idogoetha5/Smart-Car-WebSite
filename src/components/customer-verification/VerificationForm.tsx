'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AlertCircle, Camera, Check, ChevronLeft, ChevronRight, ImageIcon, Lock, RotateCcw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { OFFICE_PHONE } from '@/lib/constants';
import TurnstileWidget from '@/components/ui/Turnstile';
import { isValidIdOf, isValidPhone } from '@/lib/accident-report/schema';
import { cardBrand, BRAND_LABEL, digitsOnly, expiryValid, formatCardNumber, luhnValid } from '@/lib/customer-verification/card';

type Lang = 'he' | 'en';
type Step = 'details' | 'license' | 'card';

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
    invalidBody: 'ייתכן שהפרטים כבר נשלחו, או שתוקף הקישור עבר. המשרד ישלח לכם קישור חדש.',
    call: 'התקשרות למשרד',
    hello: (n: string) => (n ? `שלום ${n},` : 'שלום,'),
    stepDetails: 'פרטים',
    stepLicense: 'רישיון',
    stepCard: 'כרטיס',
    detailsTitle: 'השלימו את ההזמנה',
    detailsHint: 'שם וטלפון כדי שנשייך את הפרטים להזמנה שלכם. אחר כך צילום רישיון ופרטי כרטיס, כדקה בסך הכול.',
    fullName: 'שם מלא',
    phone: 'טלפון נייד',
    errName: 'כתבו שם מלא',
    errPhone: 'מספר הטלפון לא תקין',
    errBot: 'האימות לא הושלם. המתינו רגע ונסו שוב.',
    errRate: 'נשלחו יותר מדי בקשות מהמכשיר הזה. נסו שוב בעוד שעה.',
    startBtn: 'המשך לצילום הרישיון',
    licenseTitle: 'צלמו את רישיון הנהיגה',
    licenseHint: 'על משטח ישר ובאור טוב, כך שכל הפרטים קריאים.',
    front: 'צד קדמי',
    back: 'צד אחורי',
    shootFront: 'צילום הצד הקדמי',
    shootBack: 'עכשיו הצד האחורי',
    fromGallery: 'בחירה מהגלריה',
    retake: 'צילום מחדש',
    uploading: 'מעלה…',
    uploadFailed: 'התמונה לא עלתה. בדקו את החיבור וצלמו שוב.',
    needBoth: 'חסר צילום של אחד מצדי הרישיון',
    next: 'המשך לפרטי הכרטיס',
    back_: 'חזרה',
    cardTitle: 'פרטי כרטיס האשראי',
    cardHint: 'לחיובים שמגיעים אחרי ההשכרה, כמו כביש 6 ודוחות.',
    cardNumber: 'מספר כרטיס',
    expiry: 'תוקף',
    cvv: 'CVV',
    holderId: 'ת״ז בעל הכרטיס',
    holderPassport: 'דרכון בעל הכרטיס',
    foreignCard: 'בעל הכרטיס אינו תושב ישראל',
    consent:
      'אני מאשר/ת לסמארט קאר לשמור את פרטי הכרטיס באופן מאובטח ולחייב אותו בגין אגרות כביש 6, דוחות תנועה וחניה, קנסות ונזקים שמקורם בתקופת השכירות, בהתאם להסכם השכירות.',
    errCard: 'מספר הכרטיס לא תקין',
    errExpiry: 'התוקף לא תקין או שעבר (למשל 08/28)',
    errCvv: '3 הספרות שבגב הכרטיס',
    errId: 'מספר הזהות לא תקין (9 ספרות)',
    errPassport: 'מספר הדרכון לא תקין',
    errConsent: 'כדי להמשיך יש לאשר את שמירת הכרטיס והחיוב',
    errDeclined: 'חברת האשראי לא אישרה את הכרטיס. בדקו את הפרטים או נסו כרטיס אחר.',
    submit: 'שליחת הפרטים',
    sending: 'שולח…',
    submitFailed: 'הפרטים לא נשלחו. בדקו את החיבור ונסו שוב.',
    doneTitle: 'הפרטים התקבלו',
    doneBody: 'הרישיון והכרטיס שמורים אצלנו. אין צורך לעשות שום דבר נוסף, נתראה באיסוף.',
    ref: 'מספר אסמכתה',
    secure: 'מוצפן ומאובטח',
    steps: 'שלבים',
    lang: 'EN',
    langLabel: 'English',
  },
  en: {
    loading: 'Loading…',
    invalidTitle: 'This link is no longer active',
    invalidBody: 'The details may already have been sent, or the link has expired. The office will send you a new one.',
    call: 'Call the office',
    hello: (n: string) => (n ? `Hi ${n},` : 'Hi,'),
    stepDetails: 'Details',
    stepLicense: 'Licence',
    stepCard: 'Card',
    detailsTitle: 'Complete your booking',
    detailsHint: 'Your name and phone so we can match this to your booking. Then a licence photo and card details, about a minute in total.',
    fullName: 'Full name',
    phone: 'Mobile phone',
    errName: 'Enter your full name',
    errPhone: 'The phone number is not valid',
    errBot: 'The check did not finish. Wait a moment and try again.',
    errRate: 'Too many attempts from this device. Try again in an hour.',
    startBtn: 'Continue to licence photo',
    licenseTitle: 'Photograph your driving licence',
    licenseHint: 'On a flat surface in good light, with every detail readable.',
    front: 'Front',
    back: 'Back',
    shootFront: 'Photograph the front',
    shootBack: 'Now the back',
    fromGallery: 'Choose from gallery',
    retake: 'Retake',
    uploading: 'Uploading…',
    uploadFailed: 'The photo did not upload. Check your connection and try again.',
    needBoth: 'One side of the licence is missing',
    next: 'Continue to card details',
    back_: 'Back',
    cardTitle: 'Credit card details',
    cardHint: 'For charges that arrive after the rental, such as Route 6 tolls and fines.',
    cardNumber: 'Card number',
    expiry: 'Expiry',
    cvv: 'CVV',
    holderId: 'Cardholder Israeli ID',
    holderPassport: 'Cardholder passport',
    foreignCard: 'The cardholder is not an Israeli resident',
    consent:
      'I authorise SmartCar to store the card details securely and to charge the card for Route 6 tolls, traffic and parking tickets, fines and damage arising from the rental period, as set out in the rental agreement.',
    errCard: 'The card number is not valid',
    errExpiry: 'Invalid or expired (e.g. 08/28)',
    errCvv: 'The 3 digits on the back',
    errId: 'The ID number is not valid (9 digits)',
    errPassport: 'The passport number is not valid',
    errConsent: 'To continue, confirm card storage and charging',
    errDeclined: 'The card was not approved. Check the details or try another card.',
    submit: 'Send details',
    sending: 'Sending…',
    submitFailed: 'The details were not sent. Check your connection and try again.',
    doneTitle: 'Details received',
    doneBody: 'Your licence and card are on file. There is nothing else to do. See you at pickup.',
    ref: 'Reference',
    secure: 'Encrypted & secure',
    steps: 'Steps',
    lang: 'עב',
    langLabel: 'עברית',
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
  `h-14 w-full rounded-2xl border-2 bg-white px-4 text-[18px] text-[#14282A] outline-none transition-colors placeholder:text-[#A7B8B9] focus:border-[#2D5F5F] ${
    err ? 'border-[#B42318] bg-[#FFF6F5]' : 'border-[#DCE5E5]'
  }`;

const labelCls = 'px-1 text-[15px] font-bold text-[#0D2B2B]';

function Err({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="flex items-start gap-1.5 px-1 text-[14px] font-medium leading-snug text-[#B42318]">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      {msg}
    </p>
  );
}

/** On a phone the keyboard covers the lower half: keep the field being typed in visible. */
function keepInView(e: React.FocusEvent<HTMLElement>) {
  const el = e.currentTarget;
  setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 280);
}

export default function VerificationForm({ locale, token }: { locale: Lang; token?: string }) {
  const [L, setL] = useState<Lang>(locale);
  const t = T[L];
  const dir = L === 'he' ? 'rtl' : 'ltr';
  const BackIcon = L === 'he' ? ChevronRight : ChevronLeft;
  const isPublic = !token; // the fixed link: no personal token yet

  const [tk, setTk] = useState<string | undefined>(token);
  const [state, setState] = useState<'loading' | 'invalid' | 'form' | 'done'>(token ? 'loading' : 'form');
  const [step, setStep] = useState<Step>(token ? 'license' : 'details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bot, setBot] = useState('');
  const [starting, setStarting] = useState(false);
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

  /* ---------------- actions ---------------- */

  const start = async () => {
    setSubmitErr('');
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = t.errName;
    if (!isValidPhone(phone)) e.phone = t.errPhone;
    setErrors(e);
    if (Object.keys(e).length) { document.getElementById(e.name ? 'cv-name' : 'cv-phone')?.focus(); return; }
    if (!bot) { setSubmitErr(t.errBot); return; }
    setStarting(true);
    try {
      const res = await fetch('/api/customer-verification/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, lang: L, turnstileToken: bot }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 429) { setSubmitErr(t.errRate); return; }
      if (!res.ok || !d.token) {
        if (d.fields?.includes('name')) setErrors((x) => ({ ...x, name: t.errName }));
        if (d.fields?.includes('phone')) setErrors((x) => ({ ...x, phone: t.errPhone }));
        setSubmitErr(d.error === 'turnstile' ? t.errBot : d.fields ? '' : t.submitFailed);
        return;
      }
      setTk(d.token);
      setName(name.trim().split(/\s+/)[0]);
      setStep('license');
    } catch {
      setSubmitErr(t.submitFailed);
    } finally {
      setStarting(false);
    }
  };

  const upload = async (file: File | undefined, side: 'front' | 'back') => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploadErr('');
    setBusySide(side);
    try {
      const [full, small] = await Promise.all([compress(file, 2000, 0.85), compress(file, 900, 0.75)]);
      const res = await fetch('/api/customer-verification/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: tk, side, contentType: 'image/jpeg' }),
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
          t: tk,
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
        if (d.fields?.includes('license')) { setStep('license'); setErrors({ license: t.needBoth }); return; }
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

  /* ---------------- shell and shared pieces (render helpers, not components) ---------------- */

  const steps: Step[] = isPublic ? ['details', 'license', 'card'] : ['license', 'card'];
  const stepIdx = steps.indexOf(step);
  const stepLabel: Record<Step, string> = { details: t.stepDetails, license: t.stepLicense, card: t.stepCard };

  const shell = (children: React.ReactNode) => (
    <div id="cv-scroll" dir={dir} lang={L}
      className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-[#F4F7F7] text-[#14282A] [-webkit-tap-highlight-color:transparent]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col">{children}</div>
    </div>
  );

  const goBack = () => setStep(steps[Math.max(0, stepIdx - 1)]);
  // Going back to "details" would issue a second token, so the public flow stops at the licence.
  const canGoBack = state === 'form' && stepIdx > 0 && !(isPublic && step === 'license');

  const topBar = () => (
    <div className="sticky top-0 z-10 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex h-[52px] items-center justify-between px-2">
        {canGoBack ? (
          <button type="button" onClick={goBack} aria-label={t.back_}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#2D5F5F] active:bg-[#E6EFEF]">
            <BackIcon className="h-6 w-6" aria-hidden />
          </button>
        ) : <span className="w-11" />}
        <Image src="/images/logo.png" alt="SmartCar" width={90} height={30} className="h-[22px] w-auto" style={{ width: 'auto' }} priority />
        <button type="button" onClick={() => setL(L === 'he' ? 'en' : 'he')} aria-label={t.langLabel}
          className="flex h-11 min-w-11 items-center justify-center rounded-full px-2 text-[14px] font-bold text-[#2D5F5F] active:bg-[#E6EFEF]">
          {t.lang}
        </button>
      </div>
      {state === 'form' && (
        <div className="flex gap-1.5 px-4 pb-3" role="list" aria-label={t.steps}>
          {steps.map((s, i) => (
            <div key={s} role="listitem" aria-current={i === stepIdx ? 'step' : undefined} className="flex flex-1 flex-col gap-1.5">
              <span className={`h-1.5 rounded-full transition-colors ${i <= stepIdx ? 'bg-[#2D5F5F]' : 'bg-[#DCE5E5]'}`} />
              <span className={`text-[12px] ${i === stepIdx ? 'font-bold text-[#0D2B2B]' : 'text-[#7A8E8F]'}`}>{stepLabel[s]}</span>
            </div>
          ))}
        </div>
      )}
      <div className="h-px bg-[#E3EAEA]" />
    </div>
  );

  const heading = (title: string, hint: string, greet = false) => (
    <div className="px-5 pb-2 pt-5">
      {greet && name && <p className="mb-0.5 text-[16px] text-[#4A6264]">{t.hello(name)}</p>}
      <h1 ref={headingRef} tabIndex={-1} className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.01em] text-[#0D2B2B] outline-none">{title}</h1>
      <p className="mt-1.5 text-[15px] leading-relaxed text-[#4A6264]">{hint}</p>
      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#E6F2EC] px-2.5 py-1 text-[13px] font-semibold text-[#1E6B43]">
        <Lock className="h-3.5 w-3.5" aria-hidden />{t.secure}
      </p>
    </div>
  );

  const footer = (children: React.ReactNode) => (
    <div className="sticky bottom-0 z-10 mt-auto bg-gradient-to-t from-[#F4F7F7] via-[#F4F7F7] to-transparent px-4 pb-[max(env(safe-area-inset-bottom),14px)] pt-5">
      {children}
    </div>
  );

  const mainBtn = 'flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#E8743B] text-[17px] font-bold text-white shadow-[0_8px_20px_rgba(232,116,59,0.35)] transition active:scale-[0.985] active:bg-[#D9652D] disabled:opacity-60 disabled:shadow-none';
  const spinner = <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-white/40 border-t-white" aria-hidden />;

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
          <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-[25px] font-extrabold text-[#0D2B2B] outline-none">{t.invalidTitle}</h1>
          <p className="mt-3 max-w-[340px] text-[16px] leading-relaxed text-[#33494B]">{t.invalidBody}</p>
        </div>
        {footer(
          <a href={`tel:${OFFICE_PHONE}`} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#2D5F5F] bg-white text-[17px] font-bold text-[#2D5F5F] active:bg-[#E6EFEF]">
            {t.call} <span dir="ltr" className="font-semibold">{OFFICE_PHONE}</span>
          </a>,
        )}
      </>,
    );
  }

  if (state === 'done') {
    return shell(
      <>
        {topBar()}
        <div className="flex flex-1 flex-col items-center px-6 pt-14 text-center">
          <div className="cv-pop flex h-24 w-24 items-center justify-center rounded-full bg-[#2D5F5F]"><Check className="h-12 w-12 text-white" strokeWidth={3} aria-hidden /></div>
          <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-[28px] font-extrabold text-[#0D2B2B] outline-none">{t.doneTitle}</h1>
          <p className="mt-3 max-w-[330px] text-[16px] leading-relaxed text-[#33494B]">{t.doneBody}</p>
          {refId && (
            <div className="mt-8 w-full max-w-[300px] rounded-2xl bg-white px-5 py-4 ring-1 ring-black/[0.05]">
              <div className="text-[13px] text-[#5B7072]">{t.ref}</div>
              <div dir="ltr" className="mt-1 text-[24px] font-bold tabular-nums tracking-wide text-[#0D2B2B]">{refId}</div>
            </div>
          )}
          <p className="mt-6 inline-flex items-center gap-1.5 text-[13px] text-[#5B7072]"><Lock className="h-3.5 w-3.5" aria-hidden />{t.secure}</p>
        </div>
        <style>{`@keyframes cvpop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.06)}100%{transform:scale(1);opacity:1}}.cv-pop{animation:cvpop .45s ease-out both}@media (prefers-reduced-motion:reduce){.cv-pop{animation:none}}`}</style>
      </>,
    );
  }

  /* ---------------- step: details (fixed link only) ---------------- */

  if (step === 'details') {
    return shell(
      <>
        {topBar()}
        {heading(t.detailsTitle, t.detailsHint)}
        <div className="flex flex-col gap-4 px-5 pb-4 pt-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cv-name" className={labelCls}>{t.fullName}</label>
            <input id="cv-name" autoComplete="name" enterKeyHint="next" value={name} aria-invalid={!!errors.name}
              onFocus={keepInView} onChange={(e) => { setName(e.target.value.slice(0, 120)); clear('name'); }}
              className={field(errors.name)} />
            <Err id="cv-name-err" msg={errors.name} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cv-phone" className={labelCls}>{t.phone}</label>
            <input id="cv-phone" dir="ltr" type="tel" inputMode="tel" autoComplete="tel" enterKeyHint="done" value={phone} aria-invalid={!!errors.phone}
              onFocus={keepInView} onChange={(e) => { setPhone(e.target.value.slice(0, 30)); clear('phone'); }}
              className={`${field(errors.phone)} ${dir === 'rtl' ? 'text-right' : ''}`} placeholder="05X-XXXXXXX" />
            <Err id="cv-phone-err" msg={errors.phone} />
          </div>
          <div className="flex min-h-[65px] justify-center">
            <TurnstileWidget onSuccess={setBot} onExpire={() => setBot('')} onError={() => setBot('')} />
          </div>
          <Err id="cv-start-err" msg={submitErr} />
        </div>
        {footer(
          <button type="button" onClick={start} disabled={starting} className={mainBtn}>
            {starting ? <>{spinner}{t.sending}</> : t.startBtn}
          </button>,
        )}
      </>,
    );
  }

  /* ---------------- step: licence, one side at a time ---------------- */

  if (step === 'license') {
    const active: 'front' | 'back' | null = !front ? 'front' : !back ? 'back' : null;
    const rtl = dir === 'rtl';

    // Small chip per side: done (thumbnail + retake) or waiting.
    const sideChip = (side: 'front' | 'back', value: Upload | null) => {
      const label = side === 'front' ? t.front : t.back;
      const isActive = active === side;
      return (
        <div className={`flex flex-1 items-center gap-2.5 rounded-2xl p-2 ${value ? 'bg-white ring-1 ring-black/[0.06]' : isActive ? 'bg-[#E6EFEF] ring-2 ring-[#2D5F5F]' : 'bg-[#EEF3F3]'}`}>
          <div className="relative h-10 w-[63px] shrink-0 overflow-hidden rounded-lg bg-[#D3E3E3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {value && <img src={value.preview} alt="" className="h-full w-full object-cover" />}
            {value && <span className="absolute -end-0 -top-0 flex h-5 w-5 items-center justify-center rounded-bl-lg bg-[#1E7A46]"><Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden /></span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-bold text-[#0D2B2B]">{label}</div>
            {value ? (
              <label className="inline-flex min-h-8 cursor-pointer items-center gap-1 whitespace-nowrap text-[12px] font-semibold text-[#2D5F5F]">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />{t.retake}
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { upload(e.target.files?.[0], side); e.target.value = ''; }} />
              </label>
            ) : <div className="text-[13px] text-[#7A8E8F]">{busySide === side ? t.uploading : '—'}</div>}
          </div>
        </div>
      );
    };

    const viewfinder = (side: 'front' | 'back') => {
      const busy = busySide === side;
      return (
        <div className="flex flex-col gap-2">
          <label htmlFor={`cv-file-${side}`}
            className={`relative block aspect-[1.586] w-full cursor-pointer overflow-hidden rounded-[22px] bg-[#E3EEEE] transition active:scale-[0.99] ${errors.license ? 'ring-2 ring-[#B42318]' : ''}`}>
            <svg viewBox="0 0 856 540" className="absolute inset-0 h-full w-full" aria-hidden>
              {side === 'front' ? (
                <>
                  <rect x={rtl ? 600 : 76} y="140" width="180" height="240" rx="18" fill="#CFE0E0" />
                  {[160, 220, 280, 340].map((y, i) => (
                    <rect key={y} x={rtl ? 540 - (400 - i * 60) : 300} y={y} width={400 - i * 60} height="22" rx="11" fill="#CFE0E0" />
                  ))}
                </>
              ) : (
                <>
                  {[120, 190, 260, 330, 400].map((y, i) => (
                    <rect key={y} x="90" y={y} width={676 - (i % 2) * 180} height="22" rx="11" fill="#CFE0E0" />
                  ))}
                </>
              )}
            </svg>
            {['top-4 start-4 border-t-[3px] border-s-[3px] rounded-ss-2xl', 'top-4 end-4 border-t-[3px] border-e-[3px] rounded-se-2xl',
              'bottom-4 start-4 border-b-[3px] border-s-[3px] rounded-es-2xl', 'bottom-4 end-4 border-b-[3px] border-e-[3px] rounded-ee-2xl'].map((c) => (
              <span key={c} className={`absolute h-8 w-8 border-[#2D5F5F] ${c}`} aria-hidden />
            ))}
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
              {busy ? (
                <span className="flex items-center gap-2 rounded-full bg-[#0D2B2B]/85 px-4 py-2 text-[15px] font-semibold text-white" role="status">{spinner}{t.uploading}</span>
              ) : (
                <>
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2D5F5F] shadow-[0_8px_18px_rgba(45,95,95,0.35)]">
                    <Camera className="h-8 w-8 text-white" aria-hidden />
                  </span>
                  <span className="rounded-full bg-white/95 px-3.5 py-1.5 text-[15px] font-bold text-[#0D2B2B]">{side === 'front' ? t.shootFront : t.shootBack}</span>
                </>
              )}
            </span>
            <input id={`cv-file-${side}`} type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy}
              onChange={(e) => { upload(e.target.files?.[0], side); e.target.value = ''; }} />
          </label>
          <label className="mx-auto flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold text-[#2D5F5F] active:bg-[#E6EFEF]">
            <ImageIcon className="h-4 w-4" aria-hidden />{t.fromGallery}
            <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => { upload(e.target.files?.[0], side); e.target.value = ''; }} />
          </label>
        </div>
      );
    };

    return shell(
      <>
        {topBar()}
        {heading(t.licenseTitle, t.licenseHint, true)}
        <div className="flex flex-col gap-3 px-5 pb-4 pt-3">
          {active && (
            <div className="flex gap-2.5">
              {sideChip('front', front)}
              {sideChip('back', back)}
            </div>
          )}
          {active && viewfinder(active)}
          {!active && (['front', 'back'] as const).map((side) => {
            const u = side === 'front' ? front! : back!;
            const busy = busySide === side;
            return (
              <div key={side} className="overflow-hidden rounded-[20px] bg-white ring-1 ring-black/[0.06]">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u.preview} alt={side === 'front' ? t.front : t.back} className="aspect-[1.586] w-full object-cover" />
                  {busy && <span className="absolute inset-0 flex items-center justify-center gap-2 bg-[#0D2B2B]/70 text-[15px] font-semibold text-white" role="status">{spinner}{t.uploading}</span>}
                </div>
                <div className="flex items-center justify-between px-3.5 py-1.5">
                  <span className="flex items-center gap-1.5 text-[15px] font-bold text-[#0D2B2B]"><Check className="h-4 w-4 text-[#1E7A46]" strokeWidth={3} aria-hidden />{side === 'front' ? t.front : t.back}</span>
                  <label className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-[#2D5F5F] active:bg-[#E6EFEF]">
                    <RotateCcw className="h-4 w-4" aria-hidden />{t.retake}
                    <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy} onChange={(e) => { upload(e.target.files?.[0], side); e.target.value = ''; }} />
                  </label>
                </div>
              </div>
            );
          })}
          <Err id="cv-license" msg={uploadErr || errors.license} />
        </div>
        {footer(
          <button type="button" disabled={busySide !== null || !front || !back}
            onClick={() => { if (!front || !back) { setErrors({ license: t.needBoth }); return; } setErrors({}); setStep('card'); }}
            className={mainBtn}>
            {t.next}
          </button>,
        )}
      </>,
    );
  }

  /* ---------------- step: card ---------------- */

  const digits = digitsOnly(card);
  const brand = digits.length >= 2 ? cardBrand(card) : null;
  const shownNumber = (digits + '•'.repeat(Math.max(0, 16 - digits.length))).replace(/(.{4})(?=.)/g, '$1 ');
  const flipped = COLLECT_CVV && cvvFocus;

  // The SmartCar card fills in as the customer types. Compact, so the fields stay above the keyboard.
  const cardPreview = (
    <div className="px-5 pt-1 [perspective:1200px]" aria-hidden>
      <div className={`relative mx-auto aspect-[1.586] w-full max-w-[300px] transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
        <div dir="ltr" className="absolute inset-0 overflow-hidden rounded-[18px] bg-[#0D2B2B] p-4 text-white shadow-[0_12px_26px_rgba(13,43,43,0.32)] [backface-visibility:hidden]">
          <svg viewBox="0 0 400 252" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
            <path d="M-20 238 C 130 214, 220 120, 420 46" stroke="#1F4A4A" strokeWidth="54" fill="none" />
            <path d="M-20 238 C 130 214, 220 120, 420 46" stroke="#B8D8D8" strokeWidth="2.5" strokeDasharray="14 12" fill="none" opacity="0.6" />
          </svg>
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-[15px] font-extrabold tracking-tight">SmartCar</span>
              <span className="text-[13px] font-bold">{brand && brand !== 'other' ? BRAND_LABEL[brand] : ''}</span>
            </div>
            <div className="h-6 w-9 rounded-md bg-[#D9C48A]" />
            <div className="whitespace-nowrap text-[clamp(16px,5vw,20px)] font-semibold tabular-nums tracking-[0.06em]">{shownNumber}</div>
            <div className="flex items-end justify-between">
              <span className="max-w-[60%] truncate text-[12px] opacity-80">{name}</span>
              <span className={`text-[14px] font-semibold tabular-nums ${exp ? '' : 'opacity-50'}`}>{exp || 'MM/YY'}</span>
            </div>
          </div>
        </div>
        {COLLECT_CVV && (
          <div dir="ltr" className="absolute inset-0 overflow-hidden rounded-[18px] bg-[#0D2B2B] shadow-[0_12px_26px_rgba(13,43,43,0.32)] [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="mt-6 h-9 bg-[#071A1A]" />
            <div className="mx-4 mt-4 flex h-9 items-center justify-end rounded-md bg-[#E9F1F1] px-3 text-[16px] font-bold tabular-nums tracking-[0.2em] text-[#0D2B2B]">{cvv.padEnd(3, '•')}</div>
          </div>
        )}
      </div>
    </div>
  );

  return shell(
    <>
      {topBar()}
      {heading(t.cardTitle, t.cardHint)}
      {cardPreview}
      <div className="flex flex-col gap-4 px-5 pb-4 pt-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cv-card" className={labelCls}>{t.cardNumber}</label>
          <input id="cv-card" dir="ltr" inputMode="numeric" autoComplete="cc-number" enterKeyHint="next" placeholder="0000 0000 0000 0000"
            value={formatCardNumber(card)} aria-invalid={!!errors.card} aria-describedby={errors.card ? 'cv-card-err' : undefined}
            onFocus={keepInView}
            onChange={(e) => {
              const d = digitsOnly(e.target.value).slice(0, 19);
              setCard(d); clear('card');
              if (d.length === 16 && luhnValid(d)) expRef.current?.focus();
            }}
            className={`${field(errors.card)} tabular-nums tracking-[0.04em]`} />
          <Err id="cv-card-err" msg={errors.card} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cv-exp" className={labelCls}>{t.expiry}</label>
            <input id="cv-exp" ref={expRef} dir="ltr" inputMode="numeric" autoComplete="cc-exp" enterKeyHint="next" placeholder="MM/YY" maxLength={5}
              value={exp} aria-invalid={!!errors.exp} onFocus={keepInView}
              onChange={(e) => {
                const d = digitsOnly(e.target.value).slice(0, 4);
                setExp(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d); clear('exp');
                if (d.length === 4) (COLLECT_CVV ? cvvRef : idRef).current?.focus();
              }}
              className={`${field(errors.exp)} text-center tabular-nums`} />
          </div>
          {COLLECT_CVV ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cv-cvv" className={labelCls}>{t.cvv}</label>
              <input id="cv-cvv" ref={cvvRef} dir="ltr" inputMode="numeric" autoComplete="cc-csc" enterKeyHint="next" placeholder="•••" maxLength={4}
                value={cvv} aria-invalid={!!errors.cvv}
                onFocus={(e) => { setCvvFocus(true); keepInView(e); }} onBlur={() => setCvvFocus(false)}
                onChange={(e) => {
                  const d = digitsOnly(e.target.value).slice(0, 4);
                  setCvv(d); clear('cvv');
                  if (d.length === 3 && !/^3[47]/.test(digits)) idRef.current?.focus();
                }}
                className={`${field(errors.cvv)} text-center tabular-nums`} />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cv-id" className={labelCls}>{foreign ? t.holderPassport : t.holderId}</label>
              <input id="cv-id" ref={idRef} dir="ltr" inputMode={foreign ? 'text' : 'numeric'} autoComplete="off" enterKeyHint="done"
                value={holderId} aria-invalid={!!errors.id} onFocus={keepInView}
                onChange={(e) => { setHolderId(e.target.value.slice(0, 20)); clear('id'); }}
                className={`${field(errors.id)} text-center tabular-nums`} />
            </div>
          )}
        </div>
        <Err id="cv-exp-err" msg={errors.exp || errors.cvv || (!COLLECT_CVV ? errors.id : '')} />

        {COLLECT_CVV && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cv-id" className={labelCls}>{foreign ? t.holderPassport : t.holderId}</label>
            <input id="cv-id" ref={idRef} dir="ltr" inputMode={foreign ? 'text' : 'numeric'} autoComplete="off" enterKeyHint="done"
              value={holderId} aria-invalid={!!errors.id} onFocus={keepInView}
              onChange={(e) => { setHolderId(e.target.value.slice(0, 20)); clear('id'); }}
              className={`${field(errors.id)} tabular-nums`} />
            <Err id="cv-id-err" msg={errors.id} />
          </div>
        )}

        <label className="-my-1 flex min-h-11 cursor-pointer items-center gap-3 px-1 text-[14px] text-[#33494B]">
          <input type="checkbox" checked={foreign} onChange={(e) => { setForeign(e.target.checked); clear('id'); }} className="h-5 w-5 shrink-0 accent-[#2D5F5F]" />
          {t.foreignCard}
        </label>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cv-consent" className={`flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-3.5 text-[13.5px] leading-relaxed text-[#33494B] ring-1 transition ${
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
          {sending ? <>{spinner}{t.sending}</> : <><Lock className="h-5 w-5" aria-hidden />{t.submit}</>}
        </button>,
      )}
    </>,
  );
}
