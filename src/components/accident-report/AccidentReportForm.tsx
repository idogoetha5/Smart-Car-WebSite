'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertCircle, Camera, Check, ChevronLeft, ChevronRight, Clock, ImageIcon, MapPin, Mic, Phone, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { OFFICE_PHONE } from '@/lib/constants';
import TurnstileWidget from '@/components/ui/Turnstile';
import SignaturePad from './SignaturePad';
import {
  DAMAGE_ZONES,
  INSURERS,
  INSURER_LABELS,
  ROAD_LABELS,
  ROAD_TYPES,
  ZONE_LABELS,
  digits,
  formatPlate,
  insurerName,
  isValidDateParts,
  isValidIsraeliId,
  isValidLicenseNumber,
  isValidPhone,
  isValidPlate,
  type DamageZone,
  type Insurer,
  type RoadType,
} from '@/lib/accident-report/schema';
import { T, type Lang } from './strings';

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

interface Upload {
  path: string;
  thumb: string; // small data URL so thumbnails survive a reload
}

interface FormState {
  plate: string;
  model: string;
  name: string;
  idNumber: string;
  phone: string;
  address: string;
  email: string;
  licenseNumber: string;
  expD: string;
  expM: string;
  expY: string;
  licensePhoto: Upload | null;
  dateChoice: 'today' | 'yesterday' | 'other' | '';
  dateOther: string;
  time: string;
  location: string;
  roadType: RoadType | '';
  description: string;
  injured: boolean | null;
  police: boolean | null;
  policeStation: string;
  policeReport: string;
  otherInvolved: boolean | null;
  otherPlate: string;
  otherModel: string;
  insurer: Insurer | '';
  insurerOther: string;
  policy: string;
  agent: string;
  ownerName: string;
  ownerId: string;
  ownerPhone: string;
  ownerAddress: string;
  docsPhoto: Upload | null;
  photos: Upload[];
  zones: DamageZone[];
  damageOurs: string;
  damageTheirs: string;
  signature: string;
  declaration: boolean;
}

const EMPTY: FormState = {
  plate: '', model: '', name: '', idNumber: '', phone: '', address: '', email: '',
  licenseNumber: '', expD: '', expM: '', expY: '', licensePhoto: null,
  dateChoice: '', dateOther: '', time: '', location: '', roadType: '', description: '',
  injured: null, police: null, policeStation: '', policeReport: '',
  otherInvolved: null, otherPlate: '', otherModel: '', insurer: '', insurerOther: '', policy: '', agent: '',
  ownerName: '', ownerId: '', ownerPhone: '', ownerAddress: '', docsPhoto: null,
  photos: [], zones: [], damageOurs: '', damageTheirs: '', signature: '', declaration: false,
};

type Locked = Partial<Record<'plate' | 'model' | 'name' | 'idNumber' | 'phone', boolean>>;

interface Draft {
  v: 1;
  draftId: string;
  step: number;
  form: FormState;
  locked: Locked;
  savedAt: number;
}

const STORAGE_KEY = 'smartcar-accident-report';
const QUESTIONS = 10;
const CHECK = 11;
const DONE = 12;

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isoDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function accidentDate(f: FormState) {
  if (f.dateChoice === 'today') return isoDate(0);
  if (f.dateChoice === 'yesterday') return isoDate(1);
  return f.dateOther;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

type Errors = Record<string, string>;

function validate(step: number, f: FormState, t: (typeof T)['he']): Errors {
  const e: Errors = {};
  const need = (k: keyof FormState, msg: string) => {
    if (!String(f[k] ?? '').trim()) e[k] = msg;
  };
  switch (step) {
    case 0:
      if (!isValidPlate(f.plate)) e.plate = t.errPlate;
      need('model', t.errModel);
      break;
    case 1:
      need('name', t.errName);
      if (!isValidIsraeliId(f.idNumber)) e.idNumber = f.idNumber ? t.errIdInvalid : t.errId;
      if (!isValidPhone(f.phone)) e.phone = f.phone ? t.errPhoneInvalid : t.errPhone;
      need('address', t.errAddress);
      if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = t.errEmail;
      break;
    case 2:
      if (!isValidLicenseNumber(f.licenseNumber)) e.licenseNumber = f.licenseNumber ? t.errLicenseInvalid : t.errLicense;
      if (!isValidDateParts(f.expD, f.expM, f.expY)) e.licenseExpiry = f.expD || f.expM || f.expY ? t.errExpiryInvalid : t.errExpiry;
      break;
    case 3:
      if (!f.dateChoice || (f.dateChoice === 'other' && !f.dateOther)) e.date = t.errDate;
      else if (accidentDate(f) > isoDate(0)) e.date = t.errDateFuture;
      if (!/^\d{2}:\d{2}$/.test(f.time)) e.time = t.errTime;
      need('location', t.errLocation);
      break;
    case 4:
      if (!f.roadType) e.roadType = t.errRoad;
      if (f.description.trim().length < 10) e.description = t.errDescription;
      break;
    case 5:
      if (f.injured === null) e.injured = t.errInjured;
      if (f.police === null) e.police = t.errPolice;
      if (f.police) {
        need('policeStation', t.errStation);
        need('policeReport', t.errReport);
      }
      break;
    case 6:
      if (f.otherInvolved === null) e.otherInvolved = t.errOther;
      break;
    case 7:
      if (!isValidPlate(f.otherPlate)) e.otherPlate = f.otherPlate ? t.errPlateInvalid : t.errOtherPlate;
      need('otherModel', t.errOtherModel);
      if (!f.insurer) e.insurer = t.errInsurer;
      if (f.insurer === 'other') need('insurerOther', t.errInsurerOther);
      need('policy', t.errPolicy);
      break;
    case 8:
      need('ownerName', t.errOwnerName);
      if (!isValidIsraeliId(f.ownerId)) e.ownerId = f.ownerId ? t.errIdInvalid : t.errOwnerId;
      if (f.ownerPhone.trim() && !isValidPhone(f.ownerPhone)) e.ownerPhone = t.errPhoneInvalid;
      need('ownerAddress', t.errOwnerAddress);
      break;
    case 9:
      break;
    case 10:
      need('damageOurs', t.errDamageOurs);
      if (f.otherInvolved) need('damageTheirs', t.errDamageTheirs);
      break;
    case CHECK:
      if (!f.signature) e.signature = t.errSignature;
      if (!f.declaration) e.declaration = t.errDeclaration;
      break;
  }
  return e;
}

/* ------------------------------------------------------------------ */
/* Image helpers                                                       */
/* ------------------------------------------------------------------ */

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function drawScaled(img: HTMLImageElement, max: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', quality),
  );
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(b);
  });
}

/* ------------------------------------------------------------------ */
/* Small UI pieces                                                     */
/* ------------------------------------------------------------------ */

const inputCls = (err?: string) =>
  `h-14 w-full rounded-xl border-[1.5px] bg-white px-4 text-[18px] text-[#14282A] outline-none transition focus:border-brand-600 focus:ring-4 focus:ring-brand-100 ${
    err ? 'border-red-700 bg-red-50' : 'border-[#C9D6D6]'
  }`;

function ErrorText({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={`${id}-err`} className="flex items-center gap-1.5 text-[15px] font-medium text-red-700">
      <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
      {msg}
    </p>
  );
}

function Field({
  id, label, hint, error, optional, optionalLabel, children,
}: {
  id: string; label: string; hint?: string; error?: string; optional?: boolean; optionalLabel?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[16px] font-semibold text-[#14282A]">
        {label}
        {optional && <span className="ms-1 text-[14px] font-normal text-[#5B7072]">({optionalLabel})</span>}
      </label>
      {hint && <p id={`${id}-hint`} className="text-[15px] leading-snug text-[#4A6264]">{hint}</p>}
      <ErrorText id={id} msg={error} />
      {children}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-4 rounded-2xl border border-[#E1E8E8] bg-white p-[18px] ${className}`}>{children}</div>;
}

function YesNo({
  name, legend, value, onChange, error, yes, no,
}: {
  name: string; legend: string; value: boolean | null; onChange: (v: boolean) => void; error?: string; yes: string; no: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2.5" id={name}>
      <legend className="mb-2.5 text-[17px] font-semibold">{legend}</legend>
      <ErrorText id={name} msg={error} />
      <div className="grid grid-cols-2 gap-3">
        {[true, false].map((v) => {
          const sel = value === v;
          return (
            <button
              key={String(v)}
              type="button"
              role="radio"
              aria-checked={sel}
              onClick={() => onChange(v)}
              className={`h-14 rounded-xl text-[17px] font-semibold transition ${
                sel ? 'border-2 border-brand-600 bg-brand-50 text-brand-600' : 'border-[1.5px] border-[#C9D6D6] bg-white'
              }`}
            >
              {v ? yes : no}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function RadioRow({ label, hint, selected, onClick }: { label: string; hint?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3.5 rounded-xl px-4 py-2 text-start text-[17px] font-medium ${
        selected ? 'border-2 border-brand-600 bg-brand-50' : 'border-[1.5px] border-[#C9D6D6] bg-white'
      }`}
    >
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-brand-600' : 'border-[#7A9294]'}`}>
        {selected && <span className="h-3 w-3 rounded-full bg-brand-600" />}
      </span>
      <span>
        {label}
        {hint && <span className="block text-[14px] font-normal text-[#4A6264]">{hint}</span>}
      </span>
    </button>
  );
}

const ROAD_ICON: Record<RoadType, React.ReactNode> = {
  straight: <path d="M20 2v44M36 2v44" />,
  intersection: <path d="M20 2v14H4M36 2v14h16M20 46V32H4M36 46V32h16" />,
  t_junction: <path d="M4 10h48M4 26h16v20M52 26H36v20" />,
  roundabout: (
    <>
      <circle cx="28" cy="24" r="7" />
      <circle cx="28" cy="24" r="16" />
    </>
  ),
};

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function AccidentReportForm({ locale, branch, token }: { locale: Lang; branch?: string; token?: string }) {
  const t = T[locale];
  const L = locale;
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [draftId, setDraftId] = useState('');
  const [step, setStep] = useState(0);
  const [f, setF] = useState<FormState>(EMPTY);
  const [locked, setLocked] = useState<Locked>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [returnToCheck, setReturnToCheck] = useState(false);
  const [modelLookup, setModelLookup] = useState<'idle' | 'loading' | 'found' | 'missing'>('idle');
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [reportId, setReportId] = useState('');
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [gpsState, setGpsState] = useState<'idle' | 'loading' | 'error'>('idle');
  const summaryRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  /* ---- restore draft / personal link ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let draft: Draft | null = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const d = JSON.parse(raw) as Draft;
          if (d.v === 1 && Date.now() - d.savedAt < 14 * 24 * 3600 * 1000) draft = d;
        }
      } catch {}

      if (token) {
        try {
          const res = await fetch(`/api/accident-report/link?t=${encodeURIComponent(token)}`);
          const link = await res.json();
          if (cancelled) return;
          if (link.valid) {
            const sameLink = draft && (draft as Draft & { token?: string }).token === token;
            if (!sameLink) {
              const form = { ...EMPTY, plate: link.plate, model: link.model, name: link.name, phone: link.phone, idNumber: link.idNumber };
              setF(form);
              setLocked({ plate: !!link.plate, model: !!link.model, name: !!link.name, phone: !!link.phone, idNumber: !!link.idNumber });
              setDraftId(newId());
              setStep(0);
              if (link.model) setModelLookup('found');
              setReady(true);
              return;
            }
          } else {
            setLinkInvalid(true);
          }
        } catch {}
      }

      if (draft) {
        setDraftId(draft.draftId);
        setF({ ...EMPTY, ...draft.form });
        setLocked(draft.locked ?? {});
        setStep(Math.min(draft.step, CHECK));
        if (draft.form.model) setModelLookup(draft.locked?.model ? 'found' : 'missing');
      } else {
        setDraftId(newId());
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [token]);

  /* ---- the form covers the whole screen: stop the site page behind it from scrolling ---- */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ---- autosave ---- */
  useEffect(() => {
    if (!ready || step === DONE) return;
    try {
      const d: Draft & { token?: string } = { v: 1, draftId, step, form: f, locked, savedAt: Date.now(), token };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
    } catch {}
  }, [ready, draftId, step, f, locked, token]);

  const set = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v })), []);
  const blur = (k: string) => () => setTouched((p) => ({ ...p, [k]: true }));

  const errors = useMemo(() => validate(step, f, t), [step, f, t]);
  const showErr = (k: string) => (submitted[step] || touched[k] ? errors[k] : undefined);

  /* ---- navigation ---- */
  const nextStep = (s: number) => {
    if (s === 6 && f.otherInvolved === false) return 9;
    return s + 1;
  };
  const prevStep = (s: number) => {
    if (s === 9 && f.otherInvolved === false) return 6;
    return s - 1;
  };

  const goTo = (s: number) => {
    setStep(s);
    setTouched({});
    window.scrollTo({ top: 0 });
    setTimeout(() => headingRef.current?.focus({ preventScroll: true }), 50);
  };

  const onContinue = () => {
    if (Object.keys(errors).length) {
      setSubmitted((p) => ({ ...p, [step]: true }));
      setTimeout(() => {
        summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        summaryRef.current?.focus({ preventScroll: true });
      }, 30);
      return;
    }
    if (returnToCheck) {
      // After answering "yes" to another vehicle, its questions still need answers.
      if (step === 6 && f.otherInvolved && validate(7, f, t).otherPlate) return goTo(7);
      if (step === 7 && f.otherInvolved && validate(8, f, t).ownerName) return goTo(8);
      setReturnToCheck(false);
      return goTo(CHECK);
    }
    goTo(nextStep(step));
  };

  const onBack = () => {
    if (step === 0) return;
    if (returnToCheck) {
      setReturnToCheck(false);
      return goTo(CHECK);
    }
    goTo(prevStep(step));
  };

  const editFrom = (s: number) => {
    setReturnToCheck(true);
    goTo(s);
  };

  const switchLang = (target: Lang) => {
    if (target === L) return;
    const qs = new URLSearchParams();
    if (branch) qs.set('b', branch);
    if (token) qs.set('t', token);
    const q = qs.toString();
    router.replace(`/${target}/accident-report${q ? `?${q}` : ''}`);
  };

  /* ---- plate → model lookup ---- */
  const lookupModel = async () => {
    if (locked.model || !isValidPlate(f.plate)) return;
    setModelLookup('loading');
    try {
      const res = await fetch(`/api/accident-report/lookup?plate=${digits(f.plate)}`);
      const json = await res.json();
      if (json.model) {
        // Don't overwrite a model the customer already typed.
        if (!f.model.trim() || modelLookup === 'found') {
          set('model', json.model);
          setModelLookup('found');
        } else {
          setModelLookup('missing');
        }
      } else {
        setModelLookup('missing');
      }
    } catch {
      setModelLookup('missing');
    }
  };

  /* ---- uploads ---- */
  const uploadFile = async (file: File): Promise<Upload> => {
    const img = await loadImage(file);
    const [full, small] = await Promise.all([drawScaled(img, 1600, 0.82), drawScaled(img, 240, 0.7)]);
    const res = await fetch('/api/accident-report/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId, contentType: 'image/jpeg' }),
    });
    if (!res.ok) throw new Error('url');
    const { path, token: uploadToken } = await res.json();
    const { error } = await createClient().storage.from('accident-reports').uploadToSignedUrl(path, uploadToken, full, {
      contentType: 'image/jpeg',
    });
    if (error) throw error;
    return { path, thumb: await blobToDataUrl(small) };
  };

  const handleFiles = async (files: FileList | null, target: 'photos' | 'licensePhoto' | 'docsPhoto') => {
    if (!files?.length) return;
    setUploadError('');
    const list = Array.from(files).filter((x) => x.type.startsWith('image/'));
    const room = target === 'photos' ? 10 - f.photos.length : 1;
    const chosen = list.slice(0, Math.max(0, room));
    setUploading((n) => n + chosen.length);
    for (const file of chosen) {
      try {
        const up = await uploadFile(file);
        if (target === 'photos') setF((p) => ({ ...p, photos: [...p.photos, up].slice(0, 10) }));
        else set(target, up);
      } catch {
        setUploadError(t.uploadFailed);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  /* ---- GPS ---- */
  const useMyLocation = () => {
    if (!navigator.geolocation) return setGpsState('error');
    setGpsState('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('location', `GPS ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setGpsState('idle');
      },
      () => setGpsState('error'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  /* ---- submit ---- */
  const submit = async () => {
    if (Object.keys(errors).length) {
      setSubmitted((p) => ({ ...p, [CHECK]: true }));
      summaryRef.current?.focus();
      return;
    }
    setSending(true);
    setSendError('');
    const other = f.otherInvolved === true;
    const payload = {
      locale: L,
      draftId,
      branch: branch || undefined,
      linkToken: token || undefined,
      car: { plate: f.plate, model: f.model.trim() },
      driver: {
        name: f.name.trim(),
        idNumber: digits(f.idNumber),
        phone: f.phone.trim(),
        address: f.address.trim(),
        email: f.email.trim(),
        licenseNumber: digits(f.licenseNumber),
        licenseExpiry: { d: f.expD, m: f.expM, y: f.expY },
        licensePhoto: f.licensePhoto?.path,
      },
      accident: {
        date: accidentDate(f),
        time: f.time,
        location: f.location.trim(),
        roadType: f.roadType,
        description: f.description.trim(),
        injured: !!f.injured,
        police: !!f.police,
        policeStation: f.police ? f.policeStation.trim() : '',
        policeReport: f.police ? f.policeReport.trim() : '',
      },
      other: {
        involved: other,
        plate: other ? f.otherPlate : '',
        model: other ? f.otherModel.trim() : '',
        insurer: other ? f.insurer : '',
        insurerOther: other && f.insurer === 'other' ? f.insurerOther.trim() : '',
        policy: other ? f.policy.trim() : '',
        agent: other ? f.agent.trim() : '',
        ownerName: other ? f.ownerName.trim() : '',
        ownerId: other ? digits(f.ownerId) : '',
        ownerPhone: other ? f.ownerPhone.trim() : '',
        ownerAddress: other ? f.ownerAddress.trim() : '',
        docsPhoto: other ? f.docsPhoto?.path : undefined,
      },
      damage: { zones: f.zones, ours: f.damageOurs.trim(), theirs: other ? f.damageTheirs.trim() : '' },
      photos: f.photos.map((p) => p.path),
      signature: f.signature,
      declaration: true,
      turnstileToken,
    };
    try {
      const res = await fetch('/api/accident-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.id) {
        setSendError(res.status === 429 ? t.sendRateLimited : t.sendFailed);
        setSending(false);
        return;
      }
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      setReportId(json.id);
      setSending(false);
      goTo(DONE);
    } catch {
      setSendError(t.sendFailed);
      setSending(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  const dir = L === 'he' ? 'rtl' : 'ltr';
  const BackIcon = L === 'he' ? ChevronRight : ChevronLeft;
  const errorList = Object.entries(errors);
  const showSummary = submitted[step] && errorList.length > 0;

  const LangToggle = ({ inverted = false }: { inverted?: boolean }) => (
    <div className={`flex overflow-hidden rounded-full border text-[13px] font-semibold ${inverted ? 'border-white/50' : 'border-[#C9D6D6]'}`} role="group" aria-label={t.language}>
      {(['he', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          onClick={() => switchLang(l)}
          aria-pressed={L === l}
          className={`min-h-9 px-3 ${
            L === l ? (inverted ? 'bg-white text-brand-600' : 'bg-brand-600 text-white') : inverted ? 'text-white' : 'text-[#4A6264]'
          }`}
        >
          {l === 'he' ? 'עב' : 'EN'}
        </button>
      ))}
    </div>
  );

  const shell = (children: React.ReactNode) => (
    <div dir={dir} lang={L} className="fixed inset-0 z-[60] overflow-y-auto bg-[#F3F6F6] text-[#14282A]">
      <div className="mx-auto flex min-h-full w-full max-w-[520px] flex-col bg-[#F3F6F6]">{children}</div>
    </div>
  );

  if (!ready) {
    return shell(<div className="flex flex-1 items-center justify-center p-10 text-[#4A6264]">{t.loading}</div>);
  }

  const ErrorSummary = () =>
    showSummary ? (
      <div ref={summaryRef} tabIndex={-1} role="alert" className="flex flex-col gap-1.5 rounded-xl border-[3px] border-red-700 bg-white p-4 outline-none">
        <span className="text-[17px] font-bold">{errorList.length === 1 ? t.problemOne : t.problemMany}</span>
        {errorList.map(([k, msg]) => (
          <a
            key={k}
            href={`#${k}`}
            onClick={(ev) => {
              ev.preventDefault();
              const el = document.getElementById(k);
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              (el as HTMLElement | null)?.focus?.();
            }}
            className="text-[15px] font-semibold text-red-700 underline"
          >
            {msg}
          </a>
        ))}
      </div>
    ) : null;

  const Top = ({ title, hint, showProgress = true }: { title: string; hint?: string; showProgress?: boolean }) => {
    const n = Math.min(step, QUESTIONS);
    return (
      <div className="border-b border-[#E1E8E8] bg-white px-5 pb-4 pt-3.5">
        <div className="flex h-11 items-center justify-between">
          <button type="button" onClick={onBack} className="flex min-h-11 min-w-11 items-center gap-1 text-[15px] font-medium text-brand-600">
            <BackIcon className="h-5 w-5" aria-hidden />
            {t.back}
          </button>
          <Image src="/images/logo.png" alt="SmartCar" width={90} height={30} className="h-[26px] w-auto" style={{ width: 'auto' }} />
          {LangToggle({})}
        </div>
        {showProgress && (
          <>
            <div className="mt-2.5 text-[13px] font-medium text-[#4A6264]">{t.questionOf(n, QUESTIONS)}</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E1E8E8]" aria-hidden>
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(n / QUESTIONS) * 100}%` }} />
            </div>
          </>
        )}
        <h1 ref={headingRef} tabIndex={-1} className="mt-1.5 text-[26px] font-bold leading-tight outline-none">{title}</h1>
        {hint && <p className="mt-2 text-[15px] leading-snug text-[#4A6264]">{hint}</p>}
      </div>
    );
  };

  const PhotoPicker = ({ title, target }: { title: string; target: 'licensePhoto' | 'docsPhoto' }) => {
    const current = f[target];
    if (current) {
      return (
        <div className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-brand-600 bg-brand-50 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.thumb} alt="" className="h-16 w-16 rounded-lg object-cover" />
          <div className="flex-1 text-[15px] font-semibold">{title}<span className="block text-[14px] font-normal text-[#4A6264]">{t.attached}</span></div>
          <button type="button" onClick={() => set(target, null)} className="min-h-11 px-2 text-[15px] font-semibold text-brand-600">{t.remove}</button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-[#9FB4B5] bg-white p-3.5">
        <div className="text-center text-[15px] font-semibold">{title}</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex h-12 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-brand-600 text-[15px] font-semibold text-brand-600">
            <ImageIcon className="h-[18px] w-[18px]" aria-hidden /> {t.fromGallery}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { handleFiles(e.target.files, target); e.target.value = ''; }} />
          </label>
          <label className="flex h-12 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-[#C9D6D6] text-[15px] font-semibold">
            <Camera className="h-[18px] w-[18px]" aria-hidden /> {t.takePhoto}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { handleFiles(e.target.files, target); e.target.value = ''; }} />
          </label>
        </div>
      </div>
    );
  };

  /* ---------------- DONE ---------------- */
  if (step === DONE) {
    return shell(
      <>
        <div className="flex flex-col items-center gap-3.5 px-6 pb-6 pt-16 text-center">
          <Image src="/images/logo.png" alt="SmartCar" width={110} height={36} className="mb-5 h-7 w-auto" style={{ width: 'auto' }} />
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#E3F2E8]"><Check className="h-12 w-12 text-[#1E7A46]" aria-hidden /></div>
          <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-[30px] font-extrabold outline-none">{t.sentTitle}</h1>
          <div className="text-[16px] text-[#4A6264]">{t.reportNumber}</div>
          <div dir="ltr" className="rounded-xl border border-[#E1E8E8] bg-white px-5 py-2.5 text-[24px] font-bold tracking-wide">{reportId}</div>
          <p className="mt-1.5 max-w-[320px] text-[17px] leading-relaxed text-[#33494B]">{f.email ? t.sentBodyEmail : t.sentBody}</p>
        </div>
        <div className="mt-auto px-5 pb-8">
          <a href={`tel:${OFFICE_PHONE}`} className="flex h-[52px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-brand-600 bg-white text-[17px] font-semibold text-brand-600">
            <Phone className="h-[18px] w-[18px]" aria-hidden /> {t.callOffice}
          </a>
        </div>
      </>,
    );
  }

  /* ---------------- START ---------------- */
  if (step === 0) {
    const plateErr = showErr('plate');
    const modelErr = showErr('model');
    return shell(
      <>
        <div className="flex flex-col gap-5 bg-brand-600 px-5 pb-8 pt-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex rounded-[10px] bg-white px-3 py-2"><Image src="/images/logo.png" alt="SmartCar" width={100} height={32} className="h-[30px] w-auto" style={{ width: 'auto' }} priority /></div>
            {LangToggle({ inverted: true })}
          </div>
          <h1 ref={headingRef} tabIndex={-1} className="text-[32px] font-extrabold leading-tight outline-none">{t.startTitle}</h1>
          <p className="text-[17px] leading-relaxed text-[#DCEAEA]">{t.startIntro}</p>
        </div>
        <div className="flex flex-col gap-[18px] p-5">
          {linkInvalid && <div className="rounded-xl border border-[#F2C98A] bg-[#FFF4E5] p-3.5 text-[15px] text-[#6B3E00]">{t.linkExpired}</div>}
          {ErrorSummary()}
          <Card>
            {locked.plate ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[14px] text-[#4A6264]">{t.reportingFor}</span>
                  {locked.model ? <span className="text-[17px] font-semibold">{f.model}</span> : null}
                </div>
                <div dir="ltr" className="flex overflow-hidden rounded-lg border-[2.5px] border-[#14282A] bg-[#F7C600]">
                  <span className="flex items-end bg-[#1D4FA0] px-1.5 py-1 text-[11px] font-bold text-white">IL</span>
                  <span className="px-3 py-1 text-[22px] font-extrabold tracking-wide">{formatPlate(f.plate)}</span>
                </div>
              </div>
            ) : (
              <Field id="plate" label={t.plateLabel} hint={t.plateHint} error={plateErr}>
                <input
                  id="plate" dir="ltr" inputMode="numeric" autoComplete="off" enterKeyHint="next"
                  className={`${inputCls(plateErr)} text-start tracking-wide`}
                  value={f.plate}
                  onChange={(e) => { set('plate', e.target.value); if (modelLookup === 'found') set('model', ''); if (modelLookup !== 'idle') setModelLookup('idle'); }}
                  onBlur={() => { blur('plate')(); lookupModel(); }}
                  aria-invalid={!!plateErr}
                  aria-describedby={plateErr ? 'plate-err' : 'plate-hint'}
                />
              </Field>
            )}
            {!locked.model && (
              <Field id="model" label={t.modelLabel} hint={modelLookup === 'found' ? t.modelFoundHint : t.modelHint} error={modelErr}>
                <input
                  id="model" autoComplete="off" enterKeyHint="done"
                  className={inputCls(modelErr)}
                  value={f.model}
                  onChange={(e) => set('model', e.target.value)}
                  onBlur={blur('model')}
                  aria-invalid={!!modelErr}
                />
              </Field>
            )}
            {modelLookup === 'loading' && <p className="text-[15px] text-[#4A6264]">{t.lookingUp}</p>}
          </Card>
          <Card className="gap-3">
            <h2 className="text-[17px] font-bold">{t.haveReady}</h2>
            {[t.readyLicense, t.readyOther, t.readyPhotos].map((x) => (
              <div key={x} className="flex items-center gap-3 text-[16px]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-50"><Check className="h-5 w-5 text-brand-600" aria-hidden /></span>
                {x}
              </div>
            ))}
          </Card>
          <div className="flex items-center gap-2.5 rounded-xl border border-[#F2C98A] bg-[#FFF4E5] p-3.5 text-[15px] leading-snug text-[#6B3E00]">
            <AlertCircle className="h-5 w-5 shrink-0 text-[#9A5B00]" aria-hidden />
            {t.injuredFirst}
          </div>
          <a href={`/${L}/accessibility`} className="text-center text-[14px] text-[#4A6264] underline">{t.accessibility}</a>
        </div>
        <div className="sticky bottom-0 mt-auto flex flex-col gap-2 border-t border-[#E1E8E8] bg-white px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-3.5">
          <button type="button" onClick={onContinue} className="flex h-[58px] items-center justify-center rounded-[14px] bg-brand-600 text-[18px] font-bold text-white hover:bg-brand-800">{t.start}</button>
          <a href={`tel:${OFFICE_PHONE}`} className="flex h-[52px] items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-brand-600 bg-white text-[17px] font-semibold text-brand-600">
            <Phone className="h-[18px] w-[18px]" aria-hidden /> {t.callOffice}
          </a>
        </div>
      </>,
    );
  }

  /* ---------------- CHECK ---------------- */
  if (step === CHECK) {
    const o = f.otherInvolved;
    const rows = (title: string, edit: number, items: [string, string][]) => (
      <Card className="gap-0 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <button type="button" onClick={() => editFrom(edit)} className="min-h-11 px-1 text-[15px] font-semibold text-brand-600 underline">{t.change}</button>
        </div>
        {items.map(([k, v]) => (
          <div key={k} className="flex gap-3 border-b border-[#EEF1F1] py-2.5 last:border-0">
            <span className="w-28 shrink-0 text-[14px] text-[#4A6264]">{k}</span>
            <span className="min-w-0 flex-1 break-words text-[15px] font-medium">{v}</span>
          </div>
        ))}
      </Card>
    );
    const dateStr = (() => {
      const d = accidentDate(f);
      const [y, m, dd] = d.split('-');
      return y ? `${dd}.${m}.${y}` : '';
    })();
    return shell(
      <>
        {Top({ title: t.checkTitle, hint: t.checkHint, showProgress: false })}
        <div className="flex flex-col gap-[18px] p-5">
          {ErrorSummary()}
          {rows(t.secCar, 0, [[t.plateShort, formatPlate(f.plate)], [t.modelShort, f.model]])}
          {rows(t.secDriver, 1, [
            [t.nameShort, f.name], [t.idShort, f.idNumber], [t.phoneShort, f.phone], [t.addressShort, f.address],
            [t.licenseShort, `${f.licenseNumber} · ${t.validUntil} ${f.expD}.${f.expM}.${f.expY}`],
          ])}
          {rows(t.secAccident, 3, [
            [t.whenShort, `${dateStr}, ${f.time}`], [t.whereShort, f.location],
            [t.roadShort, f.roadType ? ROAD_LABELS[f.roadType][L] : ''], [t.descShort, f.description],
            [t.injuredShort, f.injured ? t.yes : t.no],
            [t.policeShort, f.police ? `${t.yes} · ${f.policeStation} · ${f.policeReport}` : t.no],
          ])}
          {rows(t.secOther, 6, o
            ? [
                [t.vehicleShort, `${formatPlate(f.otherPlate)} · ${f.otherModel}`],
                [t.insuranceShort, `${insurerName({ insurer: f.insurer, insurerOther: f.insurerOther }, L)} · ${f.policy}`],
                [t.ownerShort, `${f.ownerName} · ${f.ownerId}`], [t.phoneShort, f.ownerPhone || '—'], [t.addressShort, f.ownerAddress],
              ]
            : [[t.vehicleShort, t.noOtherVehicle]])}
          {rows(t.secDamage, 9, [
            [t.photosShort, String(f.photos.length)],
            [t.ourCarShort, `${f.zones.map((z) => ZONE_LABELS[z][L]).join(', ')}${f.zones.length ? ' · ' : ''}${f.damageOurs}`],
            ...(o ? ([[t.otherCarShort, f.damageTheirs]] as [string, string][]) : []),
          ])}
          <Card>
            <div id="signature">
              <SignaturePad value={f.signature} onChange={(v) => set('signature', v)} clearLabel={t.clear} title={t.signature} hint={t.signatureHint} hasError={!!showErr('signature')} />
              <ErrorText id="signature" msg={showErr('signature')} />
            </div>
            <label id="declaration" className="flex min-h-11 cursor-pointer items-start gap-3 text-[16px] leading-relaxed">
              <input type="checkbox" checked={f.declaration} onChange={(e) => set('declaration', e.target.checked)} className="mt-0.5 h-7 w-7 shrink-0 accent-brand-600" />
              <span>{t.declaration}</span>
            </label>
            <ErrorText id="declaration" msg={showErr('declaration')} />
          </Card>
          <div className="flex justify-center"><TurnstileWidget onSuccess={setTurnstileToken} onExpire={() => setTurnstileToken('')} /></div>
          {sendError && <div role="alert" className="rounded-xl border-[3px] border-red-700 bg-white p-4 text-[15px] font-semibold text-red-700">{sendError}</div>}
        </div>
        <div className="sticky bottom-0 mt-auto border-t border-[#E1E8E8] bg-white px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-3.5">
          <button type="button" onClick={submit} disabled={sending || !turnstileToken} className="flex h-[58px] w-full items-center justify-center rounded-[14px] bg-brand-600 text-[18px] font-bold text-white hover:bg-brand-800 disabled:opacity-60">
            {sending ? t.sending : t.send}
          </button>
          <p className="mt-2 text-center text-[13px] text-[#4A6264]">
            {t.sentDirect} · <a href={`/${L}/privacy`} className="underline">{t.privacy}</a>
          </p>
        </div>
      </>,
    );
  }

  /* ---------------- QUESTIONS 1–10 ---------------- */
  const titles: Record<number, [string, string?]> = {
    1: [t.q1Title, Object.values(locked).some(Boolean) ? t.q1HintPrefilled : undefined],
    2: [t.q2Title],
    3: [t.q3Title],
    4: [t.q4Title],
    5: [t.q5Title],
    6: [t.q6Title],
    7: [t.q7Title],
    8: [t.q8Title, t.q8Hint],
    9: [t.q9Title, t.q9Hint],
    10: [t.q10Title],
  };

  const text = (
    k: keyof FormState,
    label: string,
    opts: { hint?: string; optional?: boolean; ltr?: boolean; mode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; auto?: string; type?: string } = {},
  ) => {
    const err = showErr(k);
    return (
      <Field id={k} label={label} hint={opts.hint} error={err} optional={opts.optional} optionalLabel={t.optional}>
        <input
          id={k}
          type={opts.type ?? 'text'}
          dir={opts.ltr ? 'ltr' : undefined}
          inputMode={opts.mode}
          autoComplete={opts.auto ?? 'off'}
          enterKeyHint="next"
          className={`${inputCls(err)} ${opts.ltr ? 'text-start' : ''}`}
          value={String(f[k] ?? '')}
          onChange={(e) => set(k, e.target.value as never)}
          onBlur={blur(k)}
          aria-invalid={!!err}
          aria-describedby={[err ? `${k}-err` : '', opts.hint ? `${k}-hint` : ''].filter(Boolean).join(' ') || undefined}
        />
      </Field>
    );
  };

  const lockedRow = (k: 'name' | 'idNumber' | 'phone', label: string, ltr = false) => (
    <div className="flex items-center justify-between border-b border-[#EEF1F1] py-2.5 last:border-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] text-[#4A6264]">{label}</span>
        <span dir={ltr ? 'ltr' : undefined} className="text-start text-[16px] font-medium">{f[k]}</span>
      </div>
      <button type="button" onClick={() => setLocked((p) => ({ ...p, [k]: false }))} className="min-h-11 px-1 text-[15px] font-semibold text-brand-600 underline">{t.change}</button>
    </div>
  );

  let body: React.ReactNode = null;
  switch (step) {
    case 1:
      body = (
        <>
          {(locked.name || locked.idNumber || locked.phone) && (
            <Card className="gap-0 py-1.5">
              {locked.name && lockedRow('name', t.nameLabel)}
              {locked.idNumber && lockedRow('idNumber', t.idLabel, true)}
              {locked.phone && lockedRow('phone', t.phoneLabel, true)}
            </Card>
          )}
          <Card>
            {!locked.name && text('name', t.nameLabel, { auto: 'name' })}
            {!locked.idNumber && text('idNumber', t.idLabel, { hint: t.idHint, ltr: true, mode: 'numeric' })}
            {!locked.phone && text('phone', t.phoneLabel, { ltr: true, mode: 'tel', auto: 'tel', type: 'tel' })}
            {text('address', t.addressLabel, { hint: t.addressHint, auto: 'street-address' })}
            {text('email', t.emailLabel, { hint: t.emailHint, optional: true, ltr: true, mode: 'email', auto: 'email', type: 'email' })}
          </Card>
        </>
      );
      break;
    case 2: {
      const expErr = showErr('licenseExpiry');
      const part = (k: 'expD' | 'expM' | 'expY', label: string, w: string, max: number) => (
        <div className="flex flex-col gap-1">
          <label htmlFor={k} className="text-[14px] font-medium">{label}</label>
          <input
            id={k} dir="ltr" inputMode="numeric" maxLength={max} autoComplete="off"
            className={`${inputCls(expErr)} ${w} px-2 text-center`}
            value={f[k]}
            onChange={(e) => set(k, e.target.value.replace(/\D/g, '').slice(0, max))}
            onBlur={blur('licenseExpiry')}
          />
        </div>
      );
      body = (
        <>
          <Card>
            {text('licenseNumber', t.licenseLabel, { hint: t.licenseHint, ltr: true, mode: 'numeric' })}
            <fieldset id="licenseExpiry" className="flex flex-col gap-1.5" aria-describedby="exp-hint">
              <legend className="mb-1.5 text-[16px] font-semibold">{t.expiryLabel}</legend>
              <p id="exp-hint" className="text-[15px] text-[#4A6264]">{t.expiryHint}</p>
              <ErrorText id="licenseExpiry" msg={expErr} />
              <div className="flex gap-2.5">{part('expD', t.day, 'w-[72px]', 2)}{part('expM', t.month, 'w-[72px]', 2)}{part('expY', t.year, 'w-[104px]', 4)}</div>
            </fieldset>
          </Card>
          <Card>
            <h2 className="text-[17px] font-bold">{t.licensePhoto} <span className="text-[14px] font-normal text-[#5B7072]">({t.optional})</span></h2>
            {PhotoPicker({ title: t.licensePhotoFront, target: 'licensePhoto' })}
          </Card>
        </>
      );
      break;
    }
    case 3: {
      const dateErr = showErr('date');
      body = (
        <>
          <Card>
            <fieldset id="date" className="flex flex-col gap-2.5">
              <legend className="mb-2.5 text-[16px] font-semibold">{t.dateLabel}</legend>
              <ErrorText id="date" msg={dateErr} />
              <div className="flex flex-wrap gap-2.5">
                {(['today', 'yesterday', 'other'] as const).map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={f.dateChoice === c} onClick={() => set('dateChoice', c)}
                    className={`h-12 rounded-xl px-[18px] text-[16px] font-semibold ${f.dateChoice === c ? 'border-2 border-brand-600 bg-brand-50 text-brand-600' : 'border-[1.5px] border-[#C9D6D6] bg-white'}`}>
                    {c === 'today' ? t.today : c === 'yesterday' ? t.yesterday : t.otherDate}
                  </button>
                ))}
              </div>
              {f.dateChoice === 'other' && (
                <input type="date" aria-label={t.dateLabel} max={isoDate(0)} className={inputCls(dateErr)} value={f.dateOther} onChange={(e) => set('dateOther', e.target.value)} />
              )}
            </fieldset>
            <Field id="time" label={t.timeLabel} hint={t.timeHint} error={showErr('time')}>
              <div className="relative">
                <input id="time" type="time" dir="ltr" className={`${inputCls(showErr('time'))} text-start`} value={f.time} onChange={(e) => set('time', e.target.value)} onBlur={blur('time')} />
                <Clock className="pointer-events-none absolute end-4 top-[18px] h-5 w-5 text-[#4A6264]" aria-hidden />
              </div>
            </Field>
          </Card>
          <Card>
            {text('location', t.locationLabel, { hint: t.locationHint })}
            <button type="button" onClick={useMyLocation} className="flex min-h-11 items-center gap-1.5 self-start text-[15px] font-semibold text-brand-600">
              <MapPin className="h-[18px] w-[18px]" aria-hidden />
              {gpsState === 'loading' ? t.gpsLoading : t.useLocation}
            </button>
            {gpsState === 'error' && <p className="text-[14px] text-red-700">{t.gpsError}</p>}
          </Card>
        </>
      );
      break;
    }
    case 4:
      body = (
        <>
          <Card>
            <fieldset id="roadType" className="flex flex-col gap-2.5">
              <legend className="mb-2.5 text-[16px] font-semibold">{t.roadLabel}</legend>
              <ErrorText id="roadType" msg={showErr('roadType')} />
              <div className="grid grid-cols-2 gap-2.5">
                {ROAD_TYPES.map((r) => {
                  const sel = f.roadType === r;
                  return (
                    <button key={r} type="button" role="radio" aria-checked={sel} onClick={() => set('roadType', r)}
                      className={`flex h-[104px] flex-col items-center justify-center gap-2 rounded-[14px] text-[16px] font-semibold ${sel ? 'border-2 border-brand-600 bg-brand-50 text-brand-600' : 'border-[1.5px] border-[#C9D6D6] bg-white'}`}>
                      <svg width="56" height="44" viewBox="0 0 56 48" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>{ROAD_ICON[r]}</svg>
                      {ROAD_LABELS[r][L]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </Card>
          <Card>
            <Field id="description" label={t.descLabel} hint={t.descHint} error={showErr('description')}>
              <textarea id="description" rows={5} className={`${inputCls(showErr('description'))} h-auto min-h-[130px] resize-none py-3.5 text-[17px] leading-relaxed`}
                value={f.description} onChange={(e) => set('description', e.target.value)} onBlur={blur('description')} />
            </Field>
            <p className="flex items-center gap-1.5 text-[14px] text-[#4A6264]"><Mic className="h-4 w-4" aria-hidden />{t.micHint}</p>
          </Card>
        </>
      );
      break;
    case 5:
      body = (
        <>
          <Card><YesNo name="injured" legend={t.injuredLabel} value={f.injured} onChange={(v) => set('injured', v)} error={showErr('injured')} yes={t.yes} no={t.no} /></Card>
          <Card>
            <YesNo name="police" legend={t.policeLabel} value={f.police} onChange={(v) => set('police', v)} error={showErr('police')} yes={t.yes} no={t.no} />
            {f.police && (
              <div className="flex flex-col gap-4 border-s-4 border-[#C9D6D6] ps-4">
                {text('policeStation', t.stationLabel)}
                {text('policeReport', t.reportLabel, { hint: t.reportHint, ltr: true })}
              </div>
            )}
          </Card>
        </>
      );
      break;
    case 6:
      body = (
        <Card className="gap-2.5">
          <div id="otherInvolved" role="radiogroup" aria-label={t.q6Title} className="flex flex-col gap-2.5">
            <ErrorText id="otherInvolved" msg={showErr('otherInvolved')} />
            <RadioRow label={t.yes} selected={f.otherInvolved === true} onClick={() => set('otherInvolved', true)} />
            <RadioRow label={t.noOnlyOurs} hint={t.skipHint} selected={f.otherInvolved === false} onClick={() => set('otherInvolved', false)} />
          </div>
        </Card>
      );
      break;
    case 7:
      body = (
        <>
          <Card>
            {text('otherPlate', t.otherPlateLabel, { hint: t.otherPlateHint, ltr: true, mode: 'numeric' })}
            {text('otherModel', t.otherModelLabel, { hint: t.otherModelHint })}
          </Card>
          <Card className="gap-2.5">
            <fieldset id="insurer" className="flex flex-col gap-2.5">
              <legend className="mb-1 text-[17px] font-semibold">{t.insurerLabel}</legend>
              <ErrorText id="insurer" msg={showErr('insurer')} />
              {INSURERS.map((i) => (
                <RadioRow key={i} label={INSURER_LABELS[i][L]} selected={f.insurer === i} onClick={() => set('insurer', i)} />
              ))}
            </fieldset>
            {f.insurer === 'other' && <div className="border-s-4 border-[#C9D6D6] ps-4">{text('insurerOther', t.insurerOtherLabel)}</div>}
          </Card>
          <Card>
            {text('policy', t.policyLabel, { hint: t.policyHint, ltr: true })}
            {text('agent', t.agentLabel, { optional: true })}
          </Card>
        </>
      );
      break;
    case 8:
      body = (
        <>
          <Card>
            {text('ownerName', t.ownerNameLabel)}
            {text('ownerId', t.idLabel, { hint: t.idHint, ltr: true, mode: 'numeric' })}
            {text('ownerPhone', t.phoneLabel, { optional: true, ltr: true, mode: 'tel', type: 'tel' })}
            {text('ownerAddress', t.addressLabel, { hint: t.ownerAddressHint })}
          </Card>
          <Card>
            <h2 className="text-[17px] font-bold">{t.docsTitle} <span className="text-[14px] font-normal text-[#5B7072]">({t.optional})</span></h2>
            <p className="text-[15px] text-[#4A6264]">{t.docsHint}</p>
            {PhotoPicker({ title: t.docsPicker, target: 'docsPhoto' })}
          </Card>
        </>
      );
      break;
    case 9:
      body = (
        <Card>
          <div id="photos" tabIndex={-1} className="flex flex-col gap-4 outline-none">
            <ErrorText id="photos" msg={showErr('photos')} />
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-brand-600 text-[16px] font-bold text-white">
                <ImageIcon className="h-5 w-5" aria-hidden /> {t.fromGallery}
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { handleFiles(e.target.files, 'photos'); e.target.value = ''; }} />
              </label>
              <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-brand-600 bg-white text-[16px] font-semibold text-brand-600">
                <Camera className="h-5 w-5" aria-hidden /> {t.takePhoto}
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { handleFiles(e.target.files, 'photos'); e.target.value = ''; }} />
              </label>
            </div>
            <div className="flex justify-between">
              <span className="text-[16px] font-semibold">{t.yourPhotos}</span>
              <span className="text-[14px] text-[#4A6264]">{t.photosCount(f.photos.length)}</span>
            </div>
            {uploading > 0 && <p className="text-[15px] text-[#4A6264]" role="status">{t.uploading(uploading)}</p>}
            {uploadError && <p className="text-[15px] font-medium text-red-700" role="alert">{uploadError}</p>}
            <div className="grid grid-cols-3 gap-2.5">
              {f.photos.map((p, i) => (
                <div key={p.path} className="relative aspect-square overflow-hidden rounded-xl bg-[#C9D6D6]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt={`${t.photo} ${i + 1}`} className="h-full w-full object-cover" />
                  <button type="button" aria-label={t.removePhoto} onClick={() => set('photos', f.photos.filter((x) => x.path !== p.path))}
                    className="absolute end-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#14282A]/70">
                    <X className="h-4 w-4 text-white" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      );
      break;
    case 10:
      body = (
        <>
          <Card>
            <fieldset className="flex flex-col gap-3">
              <legend className="mb-1 text-[16px] font-semibold">{t.zonesLabel}</legend>
              <p className="text-[15px] text-[#4A6264]">{t.zonesHint}</p>
              {/* The car diagram keeps its physical layout in both languages: driver's left is on the left. */}
              <div dir="rtl" className="grid w-[250px] grid-cols-[62px_minmax(0,1fr)_62px] gap-1.5 self-center rounded-[60px_60px_40px_40px] bg-[#EEF3F3] px-3 py-3.5">
                {DAMAGE_ZONES.map((z) => {
                  const sel = f.zones.includes(z);
                  const span = z === 'front' || z === 'trunk' || z === 'rear';
                  return (
                    <button key={z} type="button" aria-pressed={sel} lang={L}
                      onClick={() => set('zones', sel ? f.zones.filter((x) => x !== z) : [...f.zones, z])}
                      className={`min-h-[52px] rounded-[10px] border-[1.5px] text-[13px] font-semibold leading-tight ${span ? 'col-span-3' : ''} ${sel ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#C9D6D6] bg-white'}`}>
                      {ZONE_LABELS[z][L]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {text('damageOurs', t.damageOursLabel, { hint: t.damageOursHint })}
          </Card>
          {f.otherInvolved && <Card>{text('damageTheirs', t.damageTheirsLabel, { hint: t.damageTheirsHint })}</Card>}
        </>
      );
      break;
  }

  const [title, hint] = titles[step] ?? [''];
  return shell(
    <>
      {Top({ title, hint })}
      <div className="flex flex-col gap-[18px] p-5">
        {ErrorSummary()}
        {body}
      </div>
      <div className="sticky bottom-0 mt-auto border-t border-[#E1E8E8] bg-white px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-3.5">
        <button
          type="button"
          onClick={onContinue}
          disabled={uploading > 0}
          className="flex h-[58px] w-full items-center justify-center gap-2 rounded-[14px] bg-brand-600 text-[18px] font-bold text-white transition hover:bg-brand-800 disabled:opacity-60"
        >
          {step === 10 && !returnToCheck ? t.reviewAndSend : t.continue}
        </button>
        <p className="mt-2 flex items-center justify-center gap-1 text-center text-[13px] text-[#4A6264]">
          <Check className="h-3.5 w-3.5" aria-hidden /> {t.autosave}
        </p>
      </div>
    </>,
  );
}
