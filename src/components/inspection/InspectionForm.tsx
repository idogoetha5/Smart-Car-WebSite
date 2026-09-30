'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, CheckCircle2, Camera, Trash2, X, WifiOff, ChevronDown, ChevronUp, ScanLine } from 'lucide-react';
import { FUEL_TAP_OPTIONS } from '@/lib/inspection-storage';
import { compressVideoIfNeeded, MAX_UPLOAD_BYTES, VideoTooLongError } from '@/lib/video-compress';
import { compressImage } from '@/lib/image-compress';
import CarDamageDiagram, { type DiagramMark } from '@/components/inspection/CarDamageDiagram';
import {
  DAMAGE_KINDS,
  SIDE_PHOTO_VIEWS,
  VIEW_LABELS,
  damageKindLabel,
  evidenceError,
  type DamageKind,
  type DamageView,
  type SidePhotoView,
} from '@/lib/inspection-damage';
import { CHECKLIST_ITEMS, type Checklist, type ChecklistItemId } from '@/lib/inspection-checklist';
import { newLocalId, OfflineError, saveDraft, sendDraft, type InspectionDraft, type SendStage } from '@/lib/inspection-outbox';

function extOf(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && ['mp4', 'mov', 'webm'].includes(fromName)) return fromName;
  if (file.type === 'video/quicktime') return 'mov';
  if (file.type === 'video/webm') return 'webm';
  return 'mp4';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

interface LocalMark {
  n: number;
  view: DamageView;
  x: number;
  y: number;
  kind: DamageKind;
  note: string;
  photo: File | null;
}

interface PendingMark {
  view: DamageView;
  x: number;
  y: number;
  kind: DamageKind | null;
  note: string;
  photo: File | null;
}

interface HandoverMark extends DiagramMark {
  kind: string;
  note: string;
}

type Stage = 'idle' | 'compressing' | SendStage | 'offline' | 'done';

const STEPS = [
  { he: 'ק״מ ודלק', en: 'Mileage & fuel' },
  { he: 'סרטון', en: 'Video' },
  { he: 'נזקים', en: 'Damage' },
] as const;

export interface InspectionFormProps {
  /** '/api/admin/inspections' or '/api/driver/inspections' — same shared inspection-actions.ts logic either way, different auth. */
  apiBase: string;
  bookingId: string;
  type: 'pickup' | 'return';
  isHe: boolean;
}

/**
 * Step-by-step inspection, shared by the admin flow and the driver app:
 *   1. odometer (typed, or read from a dashboard photo) + fuel in eighths
 *   2. walk-around video — optional, "skip"
 *   3. damage diagram (tap → type → note → optional photo) with the
 *      optional checklist folded in. On a return, handover damage is
 *      pre-drawn grey so only new damage is marked.
 * Then everything is saved on the phone first and sent (works offline —
 * it's sent when signal returns), and the app opens the in-person
 * signature screen.
 */
export default function InspectionForm({ apiBase, bookingId, type, isHe }: InspectionFormProps) {
  const router = useRouter();
  const isReturn = type === 'return';

  const [step, setStep] = useState(0);
  const [video, setVideo] = useState<File | null>(null);
  const [odometerKm, setOdometerKm] = useState('');
  const [fuelEighths, setFuelEighths] = useState<number | null>(null);
  const [ocrState, setOcrState] = useState<'idle' | 'reading' | 'failed'>('idle');
  const [marks, setMarks] = useState<LocalMark[]>([]);
  const [pending, setPending] = useState<PendingMark | null>(null);
  const [noDamage, setNoDamage] = useState(false);
  const [sidePhotos, setSidePhotos] = useState<Partial<Record<SidePhotoView, File>>>({});
  const [sidePhotosOpen, setSidePhotosOpen] = useState(false);
  const [checklist, setChecklist] = useState<Checklist>({});
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [handoverMarks, setHandoverMarks] = useState<HandoverMark[]>([]);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const [inspectionId, setInspectionId] = useState('');
  const draftRef = useRef<InspectionDraft | null>(null);

  // Return: load the damage recorded at handover (grey on the diagram).
  useEffect(() => {
    if (!isReturn || !bookingId) return;
    fetch(`/api/driver/inspections/handover?bookingId=${encodeURIComponent(bookingId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setHandoverMarks(json?.data?.marks ?? []))
      .catch(() => {});
  }, [isReturn, bookingId]);

  const evidence = evidenceError({ hasVideo: Boolean(video), markCount: marks.length, noDamage });
  const step0Ok = odometerKm.trim() !== '' && fuelEighths !== null;
  const canSubmit = step0Ok && !evidence && !pending && !uploading;

  const sideViewsTaken = useMemo(() => SIDE_PHOTO_VIEWS.filter((v) => Boolean(sidePhotos[v])), [sidePhotos]);

  const readOdometer = async (file: File) => {
    setOcrState('reading');
    try {
      const jpeg = await compressImage(file, 1280, 0.85);
      const res = await fetch('/api/driver/odometer-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: await blobToDataUrl(jpeg) }),
      });
      const json = await res.json().catch(() => ({}));
      if (typeof json?.km === 'number') {
        setOdometerKm(String(json.km));
        setOcrState('idle');
      } else {
        setOcrState('failed');
      }
    } catch {
      setOcrState('failed');
    }
  };

  const savePending = () => {
    if (!pending || !pending.kind) return;
    setMarks((prev) => [
      ...prev,
      { n: prev.length + 1, view: pending.view, x: pending.x, y: pending.y, kind: pending.kind as DamageKind, note: pending.note.trim(), photo: pending.photo },
    ]);
    setNoDamage(false);
    setPending(null);
  };

  const removeMark = (n: number) => {
    setMarks((prev) => prev.filter((m) => m.n !== n).map((m, i) => ({ ...m, n: i + 1 })));
  };

  const toggleChecklist = (id: ChecklistItemId, value: 'ok' | 'bad') => {
    setChecklist((prev) => {
      const next = { ...prev };
      if (next[id] === value) delete next[id];
      else next[id] = value;
      return next;
    });
  };

  const send = useCallback(async () => {
    const draft = draftRef.current;
    if (!draft) return;
    setUploading(true);
    setError('');
    try {
      const id = await sendDraft(draft, (s, p) => {
        setStage(s);
        setProgress(p);
      });
      setInspectionId(id);
      setStage('done');
      router.push(`/driver/inspection/${encodeURIComponent(id)}/sign`);
    } catch (err) {
      if (err instanceof OfflineError) {
        setStage('offline');
      } else {
        setError((err as Error)?.message || (isHe ? 'משהו השתבש. נסה שוב.' : 'Something went wrong. Try again.'));
        setStage('idle');
      }
    } finally {
      setUploading(false);
    }
  }, [router, isHe]);

  // Offline: retry automatically when the connection returns (and every 30s).
  useEffect(() => {
    if (stage !== 'offline') return;
    const retry = () => {
      if (navigator.onLine) void send();
    };
    window.addEventListener('online', retry);
    const timer = window.setInterval(retry, 30_000);
    return () => {
      window.removeEventListener('online', retry);
      window.clearInterval(timer);
    };
  }, [stage, send]);

  const handleSubmit = async () => {
    if (fuelEighths === null || !bookingId || evidence) return;
    setUploading(true);
    setError('');
    try {
      // Supabase's current plan caps each file at 50MB — shrink big phone
      // videos in the browser first (no-op for small ones).
      let uploadFile: File | null = video;
      if (video && video.size > MAX_UPLOAD_BYTES * 0.84) {
        setStage('compressing');
        setProgress(0);
        try {
          uploadFile = await compressVideoIfNeeded(video, (p) => setProgress(Math.round(p * 100)));
        } catch (err) {
          throw new Error(
            err instanceof VideoTooLongError
              ? (isHe ? 'הסרטון ארוך מדי. צלם סרטון קצר יותר (עד כ־4 דקות).' : 'Video is too long. Record a shorter one (about 4 minutes max).')
              : (isHe ? 'לא ניתן לכווץ את הסרטון בטלפון הזה. צלם סרטון קצר יותר.' : 'Could not compress the video on this phone. Record a shorter one.')
          );
        }
      }

      const draft: InspectionDraft = {
        localId: newLocalId(),
        createdAt: Date.now(),
        apiBase,
        bookingId,
        type,
        customerLabel: bookingId,
        odometerKm: Number(odometerKm),
        fuelEighths,
        video: uploadFile,
        videoExt: uploadFile ? extOf(uploadFile) : 'mp4',
        videoType: uploadFile?.type || 'video/mp4',
        marks: marks.map((m) => ({ view: m.view, x: m.x, y: m.y, kind: m.kind, note: m.note, photo: m.photo })),
        noDamage: noDamage && marks.length === 0,
        sidePhotos: Object.fromEntries(sideViewsTaken.map((v) => [v, sidePhotos[v] as File])),
        checklist,
      };
      // Saved on the phone first, so nothing is lost without signal.
      await saveDraft(draft);
      draftRef.current = draft;
    } catch (err) {
      setError((err as Error)?.message || (isHe ? 'משהו השתבש. נסה שוב.' : 'Something went wrong. Try again.'));
      setStage('idle');
      setUploading(false);
      return;
    }
    await send();
  };

  if (!bookingId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center" dir={isHe ? 'rtl' : 'ltr'}>
        <p className="text-gray-600">{isHe ? 'חסר מזהה הזמנה.' : 'Missing booking id.'}</p>
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center" dir={isHe ? 'rtl' : 'ltr'}>
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-2xl font-black text-gray-900 mb-4">{isHe ? 'הבדיקה נשמרה' : 'Inspection saved'}</h1>
        <button
          onClick={() => router.push(`/driver/inspection/${encodeURIComponent(inspectionId)}/sign`)}
          className="min-h-12 px-6 rounded-xl bg-[#E8743B] hover:bg-[#d4632a] text-white font-black"
        >
          {isHe ? 'לחתימת הלקוח' : 'Customer signature'}
        </button>
      </div>
    );
  }

  if (stage === 'offline') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center" dir={isHe ? 'rtl' : 'ltr'}>
        <WifiOff className="w-14 h-14 text-amber-500 mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-2xl font-black text-gray-900 mb-2">{isHe ? 'אין קליטה' : 'No signal'}</h1>
        <p className="text-gray-600 mb-6">
          {isHe
            ? 'הבדיקה נשמרה בטלפון ותישלח אוטומטית כשתחזור קליטה. אפשר להשאיר את המסך פתוח.'
            : 'The inspection is saved on this phone and will be sent automatically when signal returns.'}
        </p>
        <button
          onClick={() => void send()}
          disabled={uploading}
          className="min-h-12 px-6 rounded-xl bg-[#2D5F5F] text-white font-black disabled:opacity-50"
        >
          {uploading ? (isHe ? 'מנסה…' : 'Trying…') : (isHe ? 'נסה עכשיו' : 'Try now')}
        </button>
      </div>
    );
  }

  const stageText = (() => {
    switch (stage) {
      case 'compressing':
        return `${isHe ? 'מכווץ סרטון — לא לסגור את המסך' : 'Compressing video — keep this screen open'}… ${progress}%`;
      case 'photos':
        return `${isHe ? 'מעלה תמונות' : 'Uploading photos'}… ${progress}%`;
      case 'uploading':
        return `${isHe ? 'מעלה סרטון' : 'Uploading video'}… ${progress}%`;
      default:
        return isHe ? 'שומר...' : 'Saving…';
    }
  })();

  const title = type === 'pickup' ? (isHe ? 'בדיקת מסירת רכב' : 'Handover inspection') : (isHe ? 'בדיקת החזרת רכב' : 'Return inspection');

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-28" dir={isHe ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-black text-gray-900 mb-3">{title}</h1>

      {/* Progress */}
      <ol className="mb-6 grid grid-cols-3 gap-2" aria-label={isHe ? 'שלבים' : 'Steps'}>
        {STEPS.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              disabled={uploading || (i > 0 && !step0Ok)}
              onClick={() => setStep(i)}
              className="w-full text-start"
              aria-current={step === i ? 'step' : undefined}
            >
              <span className={`block h-2 rounded-full ${i <= step ? 'bg-[#E8743B]' : 'bg-gray-200'}`} />
              <span className={`mt-1 block text-xs font-black ${i === step ? 'text-gray-900' : 'text-gray-400'}`}>
                {i + 1}. {isHe ? s.he : s.en}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {/* Step 1: odometer + fuel */}
      {step === 0 && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <label htmlFor="odometer" className="block font-black text-gray-800 mb-3">
              {isHe ? 'קילומטראז׳' : 'Odometer'}
            </label>
            <input
              id="odometer"
              type="number"
              inputMode="numeric"
              min={0}
              value={odometerKm}
              onChange={(e) => setOdometerKm(e.target.value)}
              placeholder="0"
              className="w-full min-h-14 rounded-xl border-2 border-gray-200 px-4 text-2xl font-black text-center focus:outline-none focus:border-[#2D5F5F]"
            />
            <label className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#2D5F5F] text-sm font-black text-[#2D5F5F] cursor-pointer">
              <ScanLine className="h-5 w-5" aria-hidden="true" />
              {ocrState === 'reading'
                ? (isHe ? 'קורא את הקילומטראז׳…' : 'Reading odometer…')
                : (isHe ? 'צלם את לוח השעונים — הקילומטראז׳ יתמלא לבד' : 'Photograph the dashboard to fill it in')}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={ocrState === 'reading'}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void readOdometer(f);
                  e.target.value = '';
                }}
              />
            </label>
            {ocrState === 'failed' && (
              <p className="mt-2 text-center text-sm font-bold text-amber-700">
                {isHe ? 'לא הצלחתי לקרוא מהתמונה — הקלד ידנית.' : 'Couldn’t read it — please type it.'}
              </p>
            )}
            {odometerKm && ocrState === 'idle' && (
              <p className="mt-2 text-center text-xs text-gray-500">{isHe ? 'בדוק שהמספר נכון לפני שממשיכים.' : 'Check the number before continuing.'}</p>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <span className="block font-black text-gray-800 mb-3">{isHe ? 'רמת דלק' : 'Fuel level'}</span>
            <div className="grid grid-cols-5 gap-2" dir="ltr">
              {FUEL_TAP_OPTIONS.map((opt) => (
                <button
                  key={opt.eighths}
                  type="button"
                  onClick={() => setFuelEighths(opt.eighths)}
                  className={`min-h-14 rounded-xl border-2 font-black text-base transition-colors ${
                    fuelEighths === opt.eighths ? 'border-[#E8743B] bg-orange-50 text-[#E8743B]' : 'border-gray-200 text-gray-600'
                  }`}
                  aria-label={isHe ? opt.he : opt.en}
                >
                  {opt.symbol}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: video (optional) */}
      {step === 1 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="font-black text-gray-800 mb-1">{isHe ? 'סרטון סיור (לא חובה)' : 'Walk-around video (optional)'}</p>
          <p className="mb-4 text-sm font-bold text-gray-500">
            {isHe
              ? 'צילום ברצף: סיור מלא סביב הרכב, פנים הרכב, לוח הקילומטראז׳ ומד הדלק.'
              : 'One continuous video of the full exterior, interior, odometer and fuel gauge.'}
          </p>
          <label className="flex min-h-20 items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#2D5F5F] bg-[#eef6f6] text-[#2D5F5F] font-black cursor-pointer px-3 text-center">
            <Video className="h-7 w-7 shrink-0" aria-hidden="true" />
            {video ? `✓ ${video.name} · ${formatBytes(video.size)}` : (isHe ? 'צלם סרטון' : 'Record video')}
            <input
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
            />
          </label>
          {video && (
            <button type="button" onClick={() => setVideo(null)} className="mt-3 text-sm font-bold text-gray-500 underline">
              {isHe ? 'הסר סרטון' : 'Remove video'}
            </button>
          )}
        </div>
      )}

      {/* Step 3: damage diagram + optional checklist */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <span className="block font-black text-gray-800 mb-1">
              {isReturn ? (isHe ? 'נזקים חדשים' : 'New damage') : (isHe ? 'נזקים' : 'Damage')}
            </span>
            <p className="mb-3 text-sm font-bold text-gray-500">
              {isReturn && handoverMarks.length > 0
                ? (isHe ? 'הנקודות האפורות תועדו כבר במסירה. סמן רק נזקים חדשים: גע בנקודה, בחר סוג ואפשר להוסיף תמונה.' : 'Grey dots were recorded at handover. Mark only new damage.')
                : (isHe ? 'גע בנקודה ברכב שבה יש נזק, בחר סוג, כתוב מה רואים ואפשר להוסיף תמונה.' : 'Tap where the damage is, choose the type, add a note and optionally a photo.')}
            </p>
            <CarDamageDiagram
              marks={marks}
              ghostMarks={handoverMarks}
              isHe={isHe}
              disabled={uploading || noDamage}
              pending={pending}
              onTap={(view, x, y) => setPending({ view, x, y, kind: null, note: '', photo: null })}
            />

            {handoverMarks.length > 0 && (
              <div className="mt-3 rounded-xl bg-gray-50 p-3">
                <button type="button" onClick={() => setHandoverOpen((o) => !o)} className="flex w-full items-center justify-between text-sm font-black text-gray-600">
                  {isHe ? `נזקים שתועדו במסירה (${handoverMarks.length})` : `Recorded at handover (${handoverMarks.length})`}
                  {handoverOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {handoverOpen && (
                  <ol className="mt-2 space-y-1 text-sm text-gray-600">
                    {handoverMarks.map((m) => (
                      <li key={m.n}>
                        <span className="font-black">{m.n}.</span> {damageKindLabel(m.kind, isHe)} · {isHe ? VIEW_LABELS[m.view].he : VIEW_LABELS[m.view].en}
                        {m.note ? ` — ${m.note}` : ''}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {marks.length > 0 && (
              <ol className="mt-4 space-y-2">
                {marks.map((m) => (
                  <li key={m.n} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-black text-white">{m.n}</span>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-black text-gray-800">
                        {damageKindLabel(m.kind, isHe)} · <span className="font-bold text-gray-500">{isHe ? VIEW_LABELS[m.view].he : VIEW_LABELS[m.view].en}</span>
                      </p>
                      {m.note && <p className="text-gray-600 break-words">{m.note}</p>}
                      {m.photo && <p className="text-xs font-bold text-[#2D5F5F]">📷 {isHe ? 'תמונה מצורפת' : 'Photo attached'}</p>}
                    </div>
                    {!uploading && (
                      <button type="button" onClick={() => removeMark(m.n)} aria-label={isHe ? 'מחק' : 'Delete'} className="p-2 text-gray-400">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {marks.length === 0 && (
              <label className="mt-4 flex items-center gap-3 rounded-xl border-2 border-gray-200 p-3 font-black text-gray-800 cursor-pointer">
                <input type="checkbox" className="h-5 w-5" checked={noDamage} disabled={uploading} onChange={(e) => setNoDamage(e.target.checked)} />
                {isReturn ? (isHe ? 'אין נזקים חדשים' : 'No new damage') : (isHe ? 'אין נזקים ברכב' : 'No damage on the car')}
              </label>
            )}

            {/* Optional side photos */}
            <div className="mt-3">
              <button type="button" onClick={() => setSidePhotosOpen((o) => !o)} className="flex w-full items-center justify-between text-sm font-black text-gray-600">
                {isHe ? `צילומי 4 צדדים (לא חובה)${sideViewsTaken.length ? ` · ${sideViewsTaken.length}/4` : ''}` : `4 side photos (optional)${sideViewsTaken.length ? ` · ${sideViewsTaken.length}/4` : ''}`}
                {sidePhotosOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {sidePhotosOpen && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {SIDE_PHOTO_VIEWS.map((v) => (
                    <label
                      key={v}
                      className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 font-black cursor-pointer text-sm ${
                        sidePhotos[v] ? 'border-green-500 bg-green-50 text-green-700' : 'border-dashed border-[#2D5F5F] text-[#2D5F5F]'
                      }`}
                    >
                      <Camera className="h-5 w-5" aria-hidden="true" />
                      {sidePhotos[v] ? '✓ ' : ''}
                      {isHe ? VIEW_LABELS[v].he : VIEW_LABELS[v].en}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setSidePhotos((prev) => ({ ...prev, [v]: f }));
                        }}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Optional checklist, folded inside the damage step */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <button
              type="button"
              onClick={() => setChecklistOpen((o) => !o)}
              className="flex w-full items-center justify-between font-black text-gray-800"
              aria-expanded={checklistOpen}
            >
              <span>
                {isHe ? "צ'קליסט (לא חובה)" : 'Checklist (optional)'}
                {Object.keys(checklist).length > 0 && (
                  <span className="ms-2 text-sm font-bold text-gray-500">· {Object.keys(checklist).length}/{CHECKLIST_ITEMS.length}</span>
                )}
              </span>
              {checklistOpen ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
            </button>
            {checklistOpen && (
              <ul className="mt-3 divide-y divide-gray-100">
                {CHECKLIST_ITEMS.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="text-sm font-bold text-gray-700">{isHe ? item.he : item.en}</span>
                    <span className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => toggleChecklist(item.id, 'ok')}
                        aria-pressed={checklist[item.id] === 'ok'}
                        aria-label={isHe ? 'תקין' : 'OK'}
                        className={`h-11 w-11 rounded-xl border-2 text-lg font-black ${
                          checklist[item.id] === 'ok' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-400'
                        }`}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => toggleChecklist(item.id, 'bad')}
                        aria-pressed={checklist[item.id] === 'bad'}
                        aria-label={isHe ? 'לא תקין' : 'Not OK'}
                        className={`h-11 w-11 rounded-xl border-2 text-lg font-black ${
                          checklist[item.id] === 'bad' ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-200 text-gray-400'
                        }`}
                      >
                        ✗
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {evidence && !uploading && <p className="rounded-xl bg-amber-50 p-3 text-center text-sm font-bold text-amber-800">{evidence}</p>}
        </div>
      )}

      {error && <p className="mt-4 text-red-600 text-sm text-center">{error}</p>}
      {uploading && <div className="mt-4 text-center text-sm font-bold text-gray-600">{stageText}</div>}

      {/* Bottom navigation */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-lg gap-3">
          {step > 0 && (
            <button
              type="button"
              disabled={uploading}
              onClick={() => setStep((s) => s - 1)}
              className="min-h-14 flex-1 rounded-xl border-2 border-gray-200 bg-white font-black text-gray-700 disabled:opacity-40"
            >
              {isHe ? 'חזור' : 'Back'}
            </button>
          )}
          {step === 0 && (
            <button
              type="button"
              disabled={!step0Ok}
              onClick={() => setStep(1)}
              className="min-h-14 flex-[2] rounded-xl bg-[#E8743B] font-black text-lg text-white disabled:opacity-40"
            >
              {isHe ? 'הבא' : 'Next'}
            </button>
          )}
          {step === 1 && (
            <button
              type="button"
              onClick={() => setStep(2)}
              className="min-h-14 flex-[2] rounded-xl bg-[#E8743B] font-black text-lg text-white"
            >
              {video ? (isHe ? 'הבא' : 'Next') : (isHe ? 'דלג' : 'Skip')}
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="min-h-14 flex-[2] rounded-xl bg-[#E8743B] font-black text-lg text-white disabled:opacity-40"
            >
              {uploading ? (isHe ? 'שולח...' : 'Sending…') : (isHe ? 'לחתימת הלקוח' : 'To customer signature')}
            </button>
          )}
        </div>
      </div>

      {/* Add-damage sheet */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-5 pb-8 shadow-xl" dir={isHe ? 'rtl' : 'ltr'}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-black text-gray-900">
                {isHe ? 'נזק חדש' : 'New damage'} · {isHe ? VIEW_LABELS[pending.view].he : VIEW_LABELS[pending.view].en}
              </p>
              <button type="button" onClick={() => setPending(null)} aria-label={isHe ? 'סגור' : 'Close'} className="p-2 text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {DAMAGE_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setPending({ ...pending, kind: k.id })}
                  className={`min-h-12 rounded-xl border-2 text-sm font-black ${
                    pending.kind === k.id ? 'border-[#E8743B] bg-orange-50 text-[#E8743B]' : 'border-gray-200 text-gray-700'
                  }`}
                >
                  {isHe ? k.he : k.en}
                </button>
              ))}
            </div>
            <textarea
              value={pending.note}
              onChange={(e) => setPending({ ...pending, note: e.target.value })}
              maxLength={300}
              rows={2}
              placeholder={isHe ? 'מה רואים? (לא חובה) למשל: שריטה 10 ס״מ בדלת' : 'What do you see? (optional)'}
              className="mb-3 w-full rounded-xl border-2 border-gray-200 p-3 text-base focus:outline-none focus:border-[#2D5F5F]"
            />
            <label
              className={`mb-4 flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 font-black cursor-pointer ${
                pending.photo ? 'border-green-500 bg-green-50 text-green-700' : 'border-dashed border-[#2D5F5F] text-[#2D5F5F]'
              }`}
            >
              <Camera className="h-5 w-5" aria-hidden="true" />
              {pending.photo ? (isHe ? '✓ תמונה צורפה (החלף)' : '✓ Photo attached (replace)') : (isHe ? 'הוסף תמונה (לא חובה)' : 'Add a photo (optional)')}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPending((prev) => (prev ? { ...prev, photo: f } : prev));
                }}
              />
            </label>
            <button
              type="button"
              disabled={!pending.kind}
              onClick={savePending}
              className="w-full min-h-12 rounded-xl bg-[#2D5F5F] text-white font-black disabled:opacity-40"
            >
              {isHe ? 'שמור נזק' : 'Save damage'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
