'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Check, CheckCircle2, ChevronLeft, ChevronRight, LockKeyhole } from 'lucide-react';
import type { CountryCode } from 'libphonenumber-js';
import TurnstileWidget from '@/components/ui/Turnstile';
import CityCountryInput from '@/components/customer-details/CityCountryInput';
import PhoneWithCountryInput from '@/components/customer-details/PhoneWithCountryInput';
import { type BranchId } from '@/lib/branches';
import { composeInternationalPhone, DEFAULT_PHONE_COUNTRY, isSupportedPhoneCountry } from '@/lib/phone-prefix';

type FormValues = {
  branchId: BranchId;
  fullName: string;
  dateOfBirth: string;
  passportNumber: string;
  driverLicenseNumber: string;
  country: string;
  city: string;
  address: string;
  phone: string;
  israelAddress: string;
  email: string;
};

function emptyForm(initialBranch: BranchId): FormValues {
  return {
    branchId: initialBranch,
    fullName: '',
    dateOfBirth: '',
    passportNumber: '',
    driverLicenseNumber: '',
    country: '',
    city: '',
    address: '',
    phone: '',
    israelAddress: '',
    email: '',
  };
}

const inputClass = 'mt-1.5 w-full min-h-12 rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 shadow-sm outline-none transition focus:border-[#2D5F5F] focus:ring-4 focus:ring-[#2D5F5F]/10';
const labelClass = 'block text-sm font-bold text-[#0D2B2B]';

export default function CustomerDetailsForm({
  locale,
  initialBranch,
}: {
  locale: 'he' | 'en';
  initialBranch: BranchId;
}) {
  const isHe = locale === 'he';
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<FormValues>(() => emptyForm(initialBranch));
  const [invoiceNoticeAccepted, setInvoiceNoticeAccepted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(DEFAULT_PHONE_COUNTRY);
  const [phoneNational, setPhoneNational] = useState('');
  // Once the customer picks a prefix themselves, choosing a city no longer changes it.
  const [phoneCountryChosen, setPhoneCountryChosen] = useState(false);

  const text = isHe ? {
    title: 'פרטי לקוח להשכרת רכב',
    intro: 'יש להזין את הפרטים כפי שהם מופיעים בתעודת הזהות או בדרכון וברישיון הנהיגה.',
    steps: ['זיהוי', 'כתובת וקשר', 'אישור ושליחה'],
    next: 'המשך', back: 'חזרה', submit: 'שליחת הפרטים', sending: 'שולח…',
    identity: 'פרטי זיהוי', contact: 'כתובת ופרטי קשר', review: 'אישור הפרטים',
    fullName: 'שם מלא', dateOfBirth: 'תאריך לידה',
    passportNumber: 'מספר ת״ז / דרכון', driverLicenseNumber: 'מספר רישיון נהיגה',
    address: 'כתובת מגורים',
    phone: 'מספר טלפון', israelAddress: 'כתובת בישראל', optional: 'לא חובה',
    email: 'כתובת אימייל',
    emailHint: 'לכתובת זו יישלחו חשבוניות וחיובים עתידיים הקשורים להשכרה.',
    notice: 'כל חשבונית עתידית בגין ההשכרה ו/או דמי טיפול בגין כבישי אגרה או דוחות תישלח לכתובת האימייל שמסרתי. ידוע לי שחיובים ודמי טיפול אלה עשויים להגיע גם לאחר סיום ההשכרה, מאחר שקבלת המידע מהמפעילים או מהרשויות עשויה להימשך זמן.',
    consent: 'קראתי והבנתי.',
    privacy: 'הפרטים נשמרים במערכת המאובטחת של SmartCar. מידע נוסף מופיע במדיניות הפרטיות.',
    privacyLink: 'מדיניות הפרטיות', successTitle: 'תודה',
    successBody: 'הפרטים התקבלו ונשמרו בהצלחה.',
    another: 'מילוי טופס נוסף', error: 'לא הצלחנו לשמור את הפרטים. נסו שוב או פנו לצוות הסניף.',
    required: 'יש למלא את כל שדות החובה בשלב זה.',
  } : {
    title: 'Rental customer details',
    intro: 'Enter your details exactly as they appear on your ID or passport and driving licence.',
    steps: ['Identity', 'Address & contact', 'Review & send'],
    next: 'Continue', back: 'Back', submit: 'Submit details', sending: 'Submitting…',
    identity: 'Identification details', contact: 'Address and contact details', review: 'Review and confirm',
    fullName: 'Full name', dateOfBirth: 'Date of birth',
    passportNumber: 'ID / passport number', driverLicenseNumber: 'Driving licence number',
    address: 'Home address',
    phone: 'Phone number', israelAddress: 'Address in Israel', optional: 'Optional',
    email: 'Email address',
    emailHint: 'Future invoices and rental-related charges will be sent to this address.',
    notice: 'All future invoices related to the rental and/or handling fees for toll roads, traffic fines or parking fines will be sent to the email address I provided. I understand that these charges and handling fees may be issued after the rental has ended, as notifications from road operators or the relevant authorities may take time to arrive.',
    consent: 'I have read and understood.',
    privacy: 'Your details are stored in SmartCar’s secure system. More information is available in our Privacy Policy.',
    privacyLink: 'Privacy Policy', successTitle: 'Thank you',
    successBody: 'Your details were received and saved successfully.',
    another: 'Complete another form', error: 'We could not save your details. Please try again or speak to the branch team.',
    required: 'Please complete all required fields in this step.',
  };

  const update = (key: keyof FormValues) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
  };

  const stepOneComplete = values.fullName.trim().length >= 2 && values.dateOfBirth
    && values.passportNumber.trim().length >= 3 && values.driverLicenseNumber.trim().length >= 3;
  const stepTwoComplete = values.city.trim().length >= 2
    && values.address.trim().length >= 4
    && phoneNational.replace(/\D/g, '').length >= 4 && values.email.includes('@');

  const goNext = () => {
    if ((step === 1 && !stepOneComplete) || (step === 2 && !stepTwoComplete)) {
      setError(text.required);
      return;
    }
    setError('');
    setStep((current) => Math.min(3, current + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invoiceNoticeAccepted || !turnstileToken) {
      setError(text.required);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/customer-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, phone: composeInternationalPhone(phoneCountry, phoneNational), locale, invoiceNoticeAccepted, turnstileToken, _website: website }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'submit_failed');
      setReferenceId(json.data?.id ?? 'received');
    } catch {
      setError(text.error);
    } finally {
      setLoading(false);
    }
  };

  if (referenceId) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center" dir={isHe ? 'rtl' : 'ltr'}>
        <div className="rounded-[2rem] border border-[#B8D8D8] bg-white px-6 py-12 shadow-xl shadow-[#0D2B2B]/5 sm:px-10">
          <CheckCircle2 className="mx-auto mb-5 h-16 w-16 text-[#2D5F5F]" aria-hidden="true" />
          <h1 className="text-3xl font-black text-[#0D2B2B]">{text.successTitle}, {values.fullName}</h1>
          <p className="mx-auto mt-3 max-w-md text-base leading-7 text-gray-600">{text.successBody}</p>
          <button
            type="button"
            onClick={() => { setValues(emptyForm(initialBranch)); setPhoneCountry(DEFAULT_PHONE_COUNTRY); setPhoneNational(''); setPhoneCountryChosen(false); setInvoiceNoticeAccepted(false); setTurnstileToken(''); setReferenceId(''); setStep(1); }}
            className="mt-8 min-h-12 rounded-xl bg-[#E8743B] px-6 py-3 font-bold text-white transition hover:bg-[#d4632a] focus:outline-none focus:ring-4 focus:ring-[#E8743B]/25"
          >
            {text.another}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef6f6_0%,#f9fbfb_24rem,#f9fafb_100%)] px-4 py-7 sm:py-12" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Image src="/images/logo.png" alt="SmartCar" width={176} height={78} className="h-auto w-32 sm:w-40" priority />
          <Link
            href={`/${isHe ? 'en' : 'he'}/customer-details?branch=${values.branchId}`}
            className="rounded-full border border-[#2D5F5F]/25 bg-white px-4 py-2 text-sm font-bold text-[#2D5F5F] shadow-sm"
            hrefLang={isHe ? 'en' : 'he'}
          >
            {isHe ? 'English' : 'עברית'}
          </Link>
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-white bg-white shadow-2xl shadow-[#0D2B2B]/10">
          <div className="border-b border-gray-100 px-5 py-7 sm:px-9">
            <h1 className="text-3xl font-black tracking-tight text-[#0D2B2B] sm:text-4xl">{text.title}</h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-gray-600">{text.intro}</p>
            <ol className="mt-7 grid grid-cols-3 gap-2" aria-label={isHe ? 'שלבי הטופס' : 'Form progress'}>
              {text.steps.map((label, index) => {
                const number = index + 1;
                const done = number < step;
                const active = number === step;
                return (
                  <li key={label} className="min-w-0 text-center">
                    <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-black ${done || active ? 'bg-[#2D5F5F] text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {done ? <Check className="h-4 w-4" aria-hidden="true" /> : number}
                    </div>
                    <span className={`mt-2 block truncate text-xs font-bold ${active ? 'text-[#0D2B2B]' : 'text-gray-400'}`}>{label}</span>
                  </li>
                );
              })}
            </ol>
          </div>

          <form onSubmit={submit} className="px-5 py-7 sm:px-9 sm:py-9">
            <input type="text" value={website} onChange={(event) => setWebsite(event.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />

            {step === 1 && (
              <fieldset className="space-y-5">
                <legend className="mb-5 text-xl font-black text-[#0D2B2B]">{text.identity}</legend>
                <div>
                  <label htmlFor="full-name" className={labelClass}>{text.fullName}</label>
                  <input id="full-name" value={values.fullName} onChange={update('fullName')} className={inputClass} autoComplete="name" required maxLength={120} />
                </div>
                <div>
                  <label htmlFor="date-of-birth" className={labelClass}>{text.dateOfBirth}</label>
                  <input id="date-of-birth" type="date" value={values.dateOfBirth} onChange={update('dateOfBirth')} className={inputClass} autoComplete="bday" required max={new Date().toISOString().slice(0, 10)} />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="passport-number" className={labelClass}>{text.passportNumber}</label>
                    <input id="passport-number" value={values.passportNumber} onChange={update('passportNumber')} className={inputClass} inputMode="text" enterKeyHint="next" autoCapitalize="characters" spellCheck={false} required maxLength={32} dir="ltr" />
                  </div>
                  <div>
                    <label htmlFor="licence-number" className={labelClass}>{text.driverLicenseNumber}</label>
                    <input id="licence-number" value={values.driverLicenseNumber} onChange={update('driverLicenseNumber')} className={inputClass} inputMode="text" enterKeyHint="next" autoCapitalize="characters" spellCheck={false} required maxLength={40} dir="ltr" />
                  </div>
                </div>
              </fieldset>
            )}

            {step === 2 && (
              <fieldset className="space-y-5">
                <legend className="mb-5 text-xl font-black text-[#0D2B2B]">{text.contact}</legend>
                <CityCountryInput
                  id="city-country"
                  locale={locale}
                  city={values.city}
                  country={values.country}
                  onChange={({ city, country, countryCode }) => {
                    setValues((current) => ({ ...current, city, country }));
                    if (!phoneCountryChosen && countryCode && isSupportedPhoneCountry(countryCode)) setPhoneCountry(countryCode);
                  }}
                  inputClass={inputClass}
                  labelClass={labelClass}
                />
                <div><label htmlFor="home-address" className={labelClass}>{text.address}</label><input id="home-address" value={values.address} onChange={update('address')} className={inputClass} autoComplete="street-address" required maxLength={250} /></div>
                <PhoneWithCountryInput
                  id="phone"
                  locale={locale}
                  country={phoneCountry}
                  national={phoneNational}
                  onCountryChange={(country) => { setPhoneCountry(country); setPhoneCountryChosen(true); }}
                  onNationalChange={setPhoneNational}
                  inputClass={inputClass}
                  labelClass={labelClass}
                />
                <div><label htmlFor="israel-address" className={labelClass}>{text.israelAddress} <span className="font-normal text-gray-500">({text.optional})</span></label><input id="israel-address" value={values.israelAddress} onChange={update('israelAddress')} className={inputClass} maxLength={250} /></div>
                <div>
                  <label htmlFor="email" className={labelClass}>{text.email}</label>
                  <input id="email" type="email" value={values.email} onChange={update('email')} className={inputClass} autoComplete="email" inputMode="email" required maxLength={254} dir="ltr" />
                  <p className="mt-2 text-xs leading-5 text-gray-500">{text.emailHint}</p>
                </div>
              </fieldset>
            )}

            {step === 3 && (
              <fieldset className="space-y-6">
                <legend className="mb-5 text-xl font-black text-[#0D2B2B]">{text.review}</legend>
                <div className="rounded-2xl border border-[#B8D8D8] bg-[#eef6f6] p-5">
                  <p className="text-sm leading-7 text-[#1A3A3A]">{text.notice}</p>
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-white p-4 shadow-sm">
                    <input type="checkbox" checked={invoiceNoticeAccepted} onChange={(event) => setInvoiceNoticeAccepted(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#2D5F5F]" required />
                    <span className="text-sm font-bold leading-6 text-[#0D2B2B]">{text.consent}</span>
                  </label>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-[#2D5F5F]" aria-hidden="true" />
                  <p>{text.privacy}{' '}<Link href={`/${locale}/privacy`} className="font-bold text-[#2D5F5F] underline">{text.privacyLink}</Link></p>
                </div>
                <div className="flex justify-center"><TurnstileWidget onSuccess={setTurnstileToken} onError={() => setTurnstileToken('')} onExpire={() => setTurnstileToken('')} /></div>
              </fieldset>
            )}

            {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p>}
            <div className="mt-8 flex items-center gap-3">
              {step > 1 && <button type="button" onClick={() => { setError(''); setStep((current) => current - 1); }} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gray-300 px-5 font-bold text-gray-700 transition hover:bg-gray-50">{isHe ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}{text.back}</button>}
              {step < 3 ? (
                <button type="button" onClick={goNext} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#E8743B] px-5 font-black text-white transition hover:bg-[#d4632a] focus:outline-none focus:ring-4 focus:ring-[#E8743B]/25">{text.next}{isHe ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
              ) : (
                <button type="submit" disabled={loading} className="min-h-12 flex-1 rounded-xl bg-[#E8743B] px-5 font-black text-white transition hover:bg-[#d4632a] disabled:cursor-wait disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-[#E8743B]/25">{loading ? text.sending : text.submit}</button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
