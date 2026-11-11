'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AlertCircle, Camera, Check, ChevronLeft, ChevronRight, CreditCard, ImageIcon, Lock, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { OFFICE_PHONE } from '@/lib/constants';
import { isValidIdOf } from '@/lib/accident-report/schema';
import { cardBrand, BRAND_LABEL, digitsOnly, expiryValid, formatCardNumber, luhnValid } from '@/lib/customer-verification/card';

type Lang = 'he' | 'en';

const T = {
  he: {
    loading: 'טוען…',
    invalidTitle: 'הקישור אינו בתוקף',
    invalidBody: 'ייתכן שהפרטים כבר נשלחו או שתוקף הקישור הסתיים. לקישור חדש אפשר לפנות למשרד.',
    call: 'התקשרות למשרד',
    hello: (n: string) => (n ? `שלום ${n},` : 'שלום,'),
    intro: 'כדי להכין את הרכב לאיסוף, נבקש צילום של רישיון הנהיגה ואת פרטי כרטיס האשראי. זה לוקח כדקה.',
    secure: 'החיבור מאובטח והפרטים נשמרים מוצפנים',
    step: (n: number) => `שלב ${n} מתוך 2`,
    licenseTitle: 'רישיון נהיגה',
    licenseHint: 'צלמו את שני צדי הרישיון על משטח ישר, כשכל הפרטים קריאים.',
    front: 'צד קדמי',
    back: 'צד אחורי',
    takePhoto: 'צילום',
    fromGallery: 'מהגלריה',
    attached: 'צורף',
    replace: 'החלפה',
    uploading: 'מעלה…',
    uploadFailed: 'ההעלאה נכשלה. נסו שוב.',
    needBoth: 'יש לצרף את שני צדי הרישיון',
    next: 'המשך',
    back_: 'חזרה',
    cardTitle: 'כרטיס אשראי',
    cardHint: 'הכרטיס ישמש לחיובים לאחר השכירות, כמו כביש 6 ודוחות, בהתאם להסכם.',
    cardNumber: 'מספר כרטיס',
    expiry: 'תוקף (חודש/שנה)',
    holderId: 'ת״ז בעל הכרטיס',
    holderPassport: 'מספר דרכון בעל הכרטיס',
    foreignCard: 'בעל הכרטיס אינו תושב ישראל',
    noCvv: 'לא נבקש את שלוש הספרות שבגב הכרטיס.',
    consent:
      'אני מאשר/ת לסמארט קאר לשמור את פרטי הכרטיס באופן מאובטח ולחייב אותו בגין אגרות כביש 6, דוחות תנועה וחניה, קנסות ונזקים שיתקבלו בגין תקופת השכירות, בהתאם להסכם השכירות.',
    errCard: 'מספר הכרטיס אינו תקין',
    errExpiry: 'תוקף הכרטיס אינו תקין או שפג',
    errId: 'מספר הזהות אינו תקין',
    errPassport: 'מספר הדרכון אינו תקין',
    errConsent: 'יש לאשר את תנאי השמירה והחיוב',
    submit: 'שליחת הפרטים',
    sending: 'שולח…',
    submitFailed: 'השליחה נכשלה. בדקו את החיבור ונסו שוב.',
    doneTitle: 'הפרטים התקבלו',
    doneBody: 'תודה! הרישיון ופרטי הכרטיס נשמרו אצלנו בצורה מאובטחת. אין צורך לעשות דבר נוסף.',
    ref: 'מספר אסמכתה',
    lang: 'English',
  },
  en: {
    loading: 'Loading…',
    invalidTitle: 'This link is no longer valid',
    invalidBody: 'The details may already have been sent, or the link has expired. Contact the office for a new one.',
    call: 'Call the office',
    hello: (n: string) => (n ? `Hi ${n},` : 'Hi,'),
    intro: 'To get your car ready for pickup, we need a photo of your driving licence and your credit card details. It takes about a minute.',
    secure: 'Secure connection, details are stored encrypted',
    step: (n: number) => `Step ${n} of 2`,
    licenseTitle: 'Driving licence',
    licenseHint: 'Photograph both sides on a flat surface, with every detail readable.',
    front: 'Front',
    back: 'Back',
    takePhoto: 'Camera',
    fromGallery: 'Gallery',
    attached: 'Attached',
    replace: 'Replace',
    uploading: 'Uploading…',
    uploadFailed: 'Upload failed. Please try again.',
    needBoth: 'Please attach both sides of the licence',
    next: 'Continue',
    back_: 'Back',
    cardTitle: 'Credit card',
    cardHint: 'The card is used for charges after the rental, such as Route 6 tolls and fines, as set out in the agreement.',
    cardNumber: 'Card number',
    expiry: 'Expiry (MM/YY)',
    holderId: 'Cardholder Israeli ID',
    holderPassport: 'Cardholder passport number',
    foreignCard: 'The cardholder is not an Israeli resident',
    noCvv: 'We will not ask for the three digits on the back of the card.',
    consent:
      'I authorise SmartCar to store the card details securely and to charge the card for Route 6 tolls, traffic and parking tickets, fines and damage arising from the rental period, as set out in the rental agreement.',
    errCard: 'The card number is not valid',
    errExpiry: 'The expiry date is invalid or has passed',
    errId: 'The ID number is not valid',
    errPassport: 'The passport number is not valid',
    errConsent: 'Please confirm the storage and charging terms',
    submit: 'Send details',
    sending: 'Sending…',
    submitFailed: 'Sending failed. Check your connection and try again.',
    doneTitle: 'Details received',
    doneBody: 'Thank you! Your licence and card details are stored securely. There is nothing else you need to do.',
    ref: 'Reference',
    lang: 'עברית',
  },
} as const;

interface Upload { path: string; thumb: string }

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

const inputCls = (err?: string) =>
  `h-14 w-full rounded-xl border-[1.5px] bg-white px-4 text-[18px] text-[#14282A] outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100 ${
    err ? 'border-red-700 bg-red-50' : 'border-[#C9D6D6]'
  }`;

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1.5 text-[15px] font-medium text-red-700" role="alert">
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
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
  const [foreign, setForeign] = useState(false);
  const [holderId, setHolderId] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  const [refId, setRefId] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);

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

  useEffect(() => { headingRef.current?.focus(); window.scrollTo(0, 0); }, [step, state]);

  const upload = async (file: File | undefined, side: 'front' | 'back') => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploadErr('');
    setBusySide(side);
    try {
      const [full, small] = await Promise.all([compress(file, 2000, 0.85), compress(file, 240, 0.7)]);
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
      const thumb = URL.createObjectURL(small);
      (side === 'front' ? setFront : setBack)({ path, thumb });
      setErrors((e) => ({ ...e, license: '' }));
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
    if (!isValidIdOf(foreign ? 'passport' : 'il', holderId)) e.id = foreign ? t.errPassport : t.errId;
    if (!consent) e.consent = t.errConsent;
    setErrors(e);
    return Object.keys(e).length === 0;
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
          holderIdType: foreign ? 'passport' : 'il',
          holderId,
          consent,
        }),
      });
      if (res.status === 410) { setState('invalid'); return; }
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (d.fields?.includes('license')) { setStep(1); setErrors({ license: t.needBoth }); return; }
        setSubmitErr(t.submitFailed);
        return;
      }
      setCard(''); setExp(''); setHolderId('');
      setRefId(d.id ?? '');
      setState('done');
    } catch {
      setSubmitErr(t.submitFailed);
    } finally {
      setSending(false);
    }
  };

  const LangBtn = (
    <button type="button" onClick={() => setL(L === 'he' ? 'en' : 'he')} className="min-h-11 min-w-11 px-2 text-[15px] font-semibold text-brand-600">
      {t.lang}
    </button>
  );

  const shell = (children: React.ReactNode) => (
    <div dir={dir} lang={L} className="fixed inset-0 z-[60] overflow-y-auto bg-[#F3F6F6] text-[#14282A]">
      <div className="mx-auto flex min-h-full w-full max-w-[520px] flex-col bg-[#F3F6F6]">{children}</div>
    </div>
  );

  const logo = (cls = 'h-[26px]') => (
    <Image src="/images/logo.png" alt="SmartCar" width={90} height={30} className={`${cls} w-auto`} style={{ width: 'auto' }} priority />
  );

  if (state === 'loading') {
    return shell(<div className="flex flex-1 items-center justify-center p-10 text-[#4A6264]">{t.loading}</div>);
  }

  if (state === 'invalid') {
    return shell(
      <div className="flex flex-1 flex-col items-center gap-4 px-6 pt-16 text-center">
        {logo('h-7 mb-6')}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF4E5]"><AlertCircle className="h-10 w-10 text-[#B26A00]" aria-hidden /></div>
        <h1 ref={headingRef} tabIndex={-1} className="text-[26px] font-bold outline-none">{t.invalidTitle}</h1>
        <p className="max-w-[340px] text-[17px] leading-relaxed text-[#33494B]">{t.invalidBody}</p>
        <a href={`tel:${OFFICE_PHONE}`} className="mt-2 flex h-14 w-full max-w-[340px] items-center justify-center rounded-xl border-[1.5px] border-brand-600 text-[17px] font-semibold text-brand-600">{t.call}</a>
        <div className="mt-2">{LangBtn}</div>
      </div>,
    );
  }

  if (state === 'done') {
    return shell(
      <div className="flex flex-1 flex-col items-center gap-3.5 px-6 pb-10 pt-16 text-center">
        {logo('h-7 mb-5')}
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#E3F2E8]"><Check className="h-12 w-12 text-[#1E7A46]" aria-hidden /></div>
        <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-[30px] font-extrabold outline-none">{t.doneTitle}</h1>
        <p className="max-w-[340px] text-[17px] leading-relaxed text-[#33494B]">{t.doneBody}</p>
        {refId && (
          <>
            <div className="mt-2 text-[15px] text-[#4A6264]">{t.ref}</div>
            <div dir="ltr" className="rounded-xl border border-[#E1E8E8] bg-white px-5 py-2.5 text-[22px] font-bold tracking-wide">{refId}</div>
          </>
        )}
        <div className="mt-6 flex items-center gap-1.5 text-[14px] text-[#4A6264]"><Lock className="h-4 w-4" aria-hidden />{t.secure}</div>
      </div>,
    );
  }

  const header = (title: string, hint?: string) => (
    <div className="border-b border-[#E1E8E8] bg-white px-5 pb-4 pt-3.5">
      <div className="flex h-11 items-center justify-between">
        {step === 2 ? (
          <button type="button" onClick={() => setStep(1)} className="flex min-h-11 min-w-11 items-center gap-1 text-[15px] font-medium text-brand-600">
            <BackIcon className="h-5 w-5" aria-hidden />{t.back_}
          </button>
        ) : <span className="min-w-11" />}
        {logo()}
        {LangBtn}
      </div>
      <div className="mt-2.5 text-[13px] font-medium text-[#4A6264]">{t.step(step)}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E1E8E8]" aria-hidden>
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${step * 50}%` }} />
      </div>
      <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-[26px] font-bold leading-tight outline-none">{title}</h1>
      {hint && <p className="mt-2 text-[15px] leading-snug text-[#4A6264]">{hint}</p>}
    </div>
  );

  const picker = (side: 'front' | 'back', value: Upload | null) => {
    const label = side === 'front' ? t.front : t.back;
    if (busySide === side) {
      return <div className="flex h-[92px] items-center justify-center rounded-[14px] border-[1.5px] border-[#C9D6D6] bg-white text-[15px] text-[#4A6264]">{t.uploading}</div>;
    }
    if (value) {
      return (
        <div className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-brand-600 bg-brand-50 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.thumb} alt="" className="h-16 w-24 rounded-lg object-cover" />
          <div className="flex-1 text-[16px] font-semibold">{label}
            <span className="flex items-center gap-1 text-[14px] font-normal text-[#1E7A46]"><Check className="h-4 w-4" aria-hidden />{t.attached}</span>
          </div>
          <label className="flex min-h-11 cursor-pointer items-center px-2 text-[15px] font-semibold text-brand-600">
            {t.replace}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { upload(e.target.files?.[0], side); e.target.value = ''; }} />
          </label>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[#9FB4B5] bg-white p-3.5">
        <div className="text-center text-[16px] font-semibold">{label}</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex h-12 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] bg-brand-600 text-[15px] font-semibold text-white">
            <Camera className="h-[18px] w-[18px]" aria-hidden /> {t.takePhoto}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { upload(e.target.files?.[0], side); e.target.value = ''; }} />
          </label>
          <label className="flex h-12 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-brand-600 text-[15px] font-semibold text-brand-600">
            <ImageIcon className="h-[18px] w-[18px]" aria-hidden /> {t.fromGallery}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { upload(e.target.files?.[0], side); e.target.value = ''; }} />
          </label>
        </div>
      </div>
    );
  };

  const footer = (children: React.ReactNode) => (
    <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-t border-[#E1E8E8] bg-white px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-3.5">
      {children}
    </div>
  );

  const mainBtn = 'flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#E8743B] text-[18px] font-bold text-white disabled:opacity-60';

  if (step === 1) {
    return shell(
      <>
        {header(t.licenseTitle, t.licenseHint)}
        <div className="flex flex-col gap-4 px-5 py-5">
          <div className="rounded-2xl border border-[#E1E8E8] bg-white p-[18px]">
            <p className="text-[17px] font-semibold">{t.hello(name)}</p>
            <p className="mt-1 text-[16px] leading-relaxed text-[#33494B]">{t.intro}</p>
            <p className="mt-3 flex items-center gap-1.5 text-[14px] text-[#1E7A46]"><ShieldCheck className="h-4 w-4" aria-hidden />{t.secure}</p>
          </div>
          {picker('front', front)}
          {picker('back', back)}
          <Err msg={uploadErr || errors.license} />
        </div>
        {footer(
          <button
            type="button"
            disabled={busySide !== null}
            onClick={() => {
              if (!front || !back) { setErrors({ license: t.needBoth }); return; }
              setErrors({}); setStep(2);
            }}
            className={mainBtn}
          >
            {t.next}
          </button>
        )}
      </>,
    );
  }

  const brand = digitsOnly(card).length >= 4 ? cardBrand(card) : null;

  return shell(
    <>
      {header(t.cardTitle, t.cardHint)}
      <div className="flex flex-col gap-5 px-5 py-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-[#E1E8E8] bg-white p-[18px]">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cv-card" className="text-[16px] font-semibold">{t.cardNumber}</label>
            <Err msg={errors.card} />
            <div className="relative">
              <input
                id="cv-card" dir="ltr" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000"
                value={formatCardNumber(card)} onChange={(e) => setCard(digitsOnly(e.target.value).slice(0, 19))}
                className={`${inputCls(errors.card)} pe-28 tracking-wider`} aria-invalid={!!errors.card}
              />
              <span dir="ltr" className="pointer-events-none absolute end-4 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-[14px] font-semibold text-[#4A6264]">
                <CreditCard className="h-5 w-5" aria-hidden />{brand && brand !== 'other' ? BRAND_LABEL[brand] : ''}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cv-exp" className="text-[16px] font-semibold">{t.expiry}</label>
            <Err msg={errors.exp} />
            <input
              id="cv-exp" dir="ltr" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" maxLength={5}
              value={exp}
              onChange={(e) => {
                const d = digitsOnly(e.target.value).slice(0, 4);
                setExp(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
              }}
              className={`${inputCls(errors.exp)} max-w-[180px] text-center`} aria-invalid={!!errors.exp}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cv-id" className="text-[16px] font-semibold">{foreign ? t.holderPassport : t.holderId}</label>
            <Err msg={errors.id} />
            <input
              id="cv-id" dir="ltr" inputMode={foreign ? 'text' : 'numeric'} autoComplete="off"
              value={holderId} onChange={(e) => setHolderId(e.target.value.slice(0, 20))}
              className={inputCls(errors.id)} aria-invalid={!!errors.id}
            />
            <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-[#33494B]">
              <input type="checkbox" checked={foreign} onChange={(e) => { setForeign(e.target.checked); setErrors((x) => ({ ...x, id: '' })); }} className="h-5 w-5 accent-[#2D5F5F]" />
              {t.foreignCard}
            </label>
          </div>

          <p className="flex items-start gap-1.5 text-[14px] leading-snug text-[#4A6264]"><Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{t.noCvv}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Err msg={errors.consent} />
          <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] bg-white p-4 text-[15px] leading-relaxed ${errors.consent ? 'border-red-700' : 'border-[#E1E8E8]'}`}>
            <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErrors((x) => ({ ...x, consent: '' })); }} className="mt-1 h-5 w-5 shrink-0 accent-[#2D5F5F]" />
            <span>{t.consent}</span>
          </label>
        </div>
        <Err msg={submitErr} />
      </div>
      {footer(
        <button type="button" onClick={submit} disabled={sending} className={mainBtn}>
          <Lock className="h-5 w-5" aria-hidden />{sending ? t.sending : t.submit}
        </button>
      )}
    </>,
  );
}
