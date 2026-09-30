'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, CheckCircle2, Camera, Trash2, X } from 'lucide-react';
import { FUEL_TAP_OPTIONS } from '@/lib/inspection-storage';
import { compressVideoIfNeeded, MAX_UPLOAD_BYTES, VideoTooLongError } from '@/lib/video-compress';
import { compressImage } from '@/lib/image-compress';
import { createClient } from '@/lib/supabase/client';
import CarDamageDiagram from '@/components/inspection/CarDamageDiagram';
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

const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

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

type Stage = 'idle' | 'compressing' | 'creating' | 'photos' | 'uploading' | 'finishing' | 'done';

export interface InspectionFormProps {
  /** '/api/admin/inspections' or '/api/driver/inspections' — same shared inspection-actions.ts logic either way, different auth. */
  apiBase: string;
  bookingId: string;
  type: 'pickup' | 'return';
  isHe: boolean;
  /** Where the "track status" button on the done screen navigates to. */
  statusHref: (inspectionId: string, signLink: string) => string;
}

/**
 * Inspection capture, shared by the admin flow and the driver app (same
 * component, different apiBase). Odometer + fuel are always required; for
 * the car's condition the driver needs at least one of: a walk-around
 * video, damage marked on the car diagram (tap a spot → type → note →
 * optional photo), or "no damage" + a photo of each of the 4 sides.
 */
export default function InspectionForm({ apiBase, bookingId, type, isHe, statusHref }: InspectionFormProps) {
  const router = useRouter();

  const [video, setVideo] = useState<File | null>(null);
  const [odometerKm, setOdometerKm] = useState('');
  const [fuelEighths, setFuelEighths] = useState<number | null>(null);
  const [marks, setMarks] = useState<LocalMark[]>([]);
  const [pending, setPending] = useState<PendingMark | null>(null);
  const [noDamage, setNoDamage] = useState(false);
  const [sidePhotos, setSidePhotos] = useState<Partial<Record<SidePhotoView, File>>>({});
  const [checklist, setChecklist] = useState<Checklist>({});
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState('');
  const [inspectionId, setInspectionId] = useState('');
  const [signLink, setSignLink] = useState('');
  const [signLinkSent, setSignLinkSent] = useState(true);

  const sideViewsTaken = useMemo(
    () => SIDE_PHOTO_VIEWS.filter((v) => Boolean(sidePhotos[v])),
    [sidePhotos]
  );
  const evidence = evidenceError({
    hasVideo: Boolean(video),
    markCount: marks.length,
    noDamage,
    sidePhotoViews: noDamage ? sideViewsTaken : [],
  });
  const canSubmit =
    !evidence && !pending && odometerKm.trim() !== '' && fuelEighths !== null && !uploading;

  const savePending = () => {
    if (!pending || !pending.kind) return;
    setMarks((prev) => [
      ...prev,
      { n: prev.length + 1, view: pending.view, x: pending.x, y: pending.y, kind: pending.kind as DamageKind, note: pending.note.trim(), photo: pending.photo },
    ]);
    setNoDamage(false);
    setPending(null);
  };

  const toggleChecklist = (id: ChecklistItemId, value: 'ok' | 'bad') => {
    setChecklist((prev) => {
      const next = { ...prev };
      if (next[id] === value) delete next[id];
      else next[id] = value;
      return next;
    });
  };

  const removeMark = (n: number) => {
    setMarks((prev) => prev.filter((m) => m.n !== n).map((m, i) => ({ ...m, n: i + 1 })));
  };

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

      const usedSideViews = noDamage && marks.length === 0 ? sideViewsTaken : [];

      setStage('creating');
      const createRes = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          type,
          odometerKm: Number(odometerKm),
          fuelEighths,
          hasVideo: Boolean(uploadFile),
          videoExt: uploadFile ? extOf(uploadFile) : 'mp4',
          damageMarks: marks.map((m) => ({ view: m.view, x: m.x, y: m.y, kind: m.kind, note: m.note, hasPhoto: Boolean(m.photo) })),
          noDamage: noDamage && marks.length === 0,
          sidePhotoViews: usedSideViews,
          checklist,
        }),
      });
      const created = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(created?.error || 'Failed to start inspection');
      setInspectionId(created.inspectionId);

      // Photos first (small), then the video.
      const photoUploads: Array<{ key: string; path: string; token: string }> = created.photos ?? [];
      if (photoUploads.length) {
        setStage('photos');
        setProgress(0);
        const supabase = createClient();
        const fileForKey = (key: string): File | null => {
          if (key.startsWith('mark-')) return marks.find((m) => `mark-${m.n}` === key)?.photo ?? null;
          if (key.startsWith('side-')) return sidePhotos[key.slice(5) as SidePhotoView] ?? null;
          return null;
        };
        let doneCount = 0;
        for (const p of photoUploads) {
          const original = fileForKey(p.key);
          if (!original) throw new Error(isHe ? 'תמונה חסרה. נסה שוב.' : 'A photo is missing. Try again.');
          const jpeg = await compressImage(original);
          let lastError: string | null = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            const { error: upErr } = await supabase.storage
              .from(created.bucket)
              .uploadToSignedUrl(p.path, p.token, jpeg, { contentType: 'image/jpeg' });
            if (!upErr) {
              lastError = null;
              break;
            }
            lastError = upErr.message;
            await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          }
          if (lastError) throw new Error(isHe ? `העלאת תמונה נכשלה: ${lastError}` : `Photo upload failed: ${lastError}`);
          doneCount++;
          setProgress(Math.round((doneCount / photoUploads.length) * 100));
        }
      }

      if (uploadFile && created.video) {
        setStage('uploading');
        setProgress(0);
        const fileToSend = uploadFile;
        const tus = await import('tus-js-client');
        await new Promise<void>((resolve, reject) => {
          const upload = new tus.Upload(fileToSend, {
            endpoint: created.video.uploadEndpoint,
            retryDelays: [0, 3000, 5000, 10000, 20000],
            chunkSize: 6 * 1024 * 1024,
            // Signed-upload endpoint: Storage authorises the upload from the
            // server-issued token in x-signature (scoped to this one path),
            // not from the anon role's RLS policies.
            headers: {
              apikey: SUPABASE_ANON_KEY,
              'x-signature': created.video.uploadToken,
            },
            uploadDataDuringCreation: true,
            storeFingerprintForResuming: false,
            metadata: {
              bucketName: created.bucket,
              objectName: created.video.path,
              contentType: (fileToSend.type || 'video/mp4').split(';')[0],
            },
            onError: (err) => reject(err),
            onProgress: (uploaded, total) => setProgress(Math.round((uploaded / total) * 100)),
            onSuccess: () => resolve(),
          });
          // Each submit creates a new inspection with its own object path and
          // token, so never resume an older upload (it would target a
          // different inspection's path). Network blips within this upload
          // are still retried via retryDelays.
          upload.start();
        });
      }

      setStage('finishing');
      const completeRes = await fetch(`${apiBase}/${created.inspectionId}/complete`, { method: 'POST' });
      const completed = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok) throw new Error(completed?.error || 'Failed to finish inspection');

      setSignLink(completed.signLink ?? '');
      setSignLinkSent(completed.signLinkSent !== false);
      setStage('done');
    } catch (err) {
      setError((err as Error)?.message || (isHe ? 'משהו השתבש. נסה שוב.' : 'Something went wrong. Try again.'));
      setStage('idle');
    } finally {
      setUploading(false);
    }
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
        <h1 className="text-2xl font-black text-gray-900 mb-2">
          {isHe ? 'הבדיקה נשמרה' : 'Inspection saved'}
        </h1>
        {signLinkSent ? (
          <p className="text-gray-600 mb-6">
            {isHe
              ? 'נשלח ללקוח מייל עם פרטי הבדיקה וטופס לחתימה. לאחר שיחתום, המסמך החתום יישלח למשרד.'
              : 'The customer was emailed the inspection and a form to sign. Once signed, the signed document goes to the office.'}
          </p>
        ) : (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-start">
            <p className="font-bold text-red-700 mb-2">
              {isHe ? 'המייל ללקוח לא נשלח. שלח לו את הקישור ידנית:' : 'The customer email failed. Send the link manually:'}
            </p>
            {signLink && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(signLink)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block min-h-11 px-4 py-2 rounded-lg bg-green-600 text-white font-bold"
              >
                {isHe ? 'שליחה בוואטסאפ' : 'Send via WhatsApp'}
              </a>
            )}
          </div>
        )}
        <button
          onClick={() => router.push(statusHref(inspectionId, signLink))}
          className="min-h-12 px-6 rounded-xl bg-[#E8743B] hover:bg-[#d4632a] text-white font-black"
        >
          {isHe ? 'מעקב אחר סטטוס' : 'Track status'}
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

  return (
    <div className="max-w-lg mx-auto px-4 py-8" dir={isHe ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-black text-gray-900 mb-1">
        {type === 'pickup' ? (isHe ? 'בדיקת מסירת רכב' : 'Handover inspection') : (isHe ? 'בדיקת החזרת רכב' : 'Return inspection')}
      </h1>
      <p className="text-gray-500 text-sm mb-2" dir="ltr">{bookingId}</p>
      <p className="mb-6 rounded-xl bg-[#eef6f6] p-3 text-sm font-bold text-[#2D5F5F]">
        {isHe
          ? 'חובה: קילומטראז׳ ודלק. למצב הרכב — סרטון, או סימון נזקים בשרטוט (אפשר גם וגם).'
          : 'Required: odometer and fuel. For the car’s condition — a video, or damage marked on the diagram (or both).'}
      </p>

      <div className="space-y-5">
        {/* Video */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <label className="block font-black text-gray-800 mb-2">
            {isHe ? 'סרטון סיור: סביב הרכב ופנים הרכב' : 'Walk-around video: exterior and interior'}
          </label>
          <p className="mb-3 text-sm font-bold text-gray-500">
            {isHe
              ? 'צילום ברצף: סיור מלא סביב הרכב, פנים הרכב, לוח הקילומטראז׳ ומד הדלק.'
              : 'One continuous video of the full exterior, interior, odometer and fuel gauge.'}
          </p>
          <label className="flex min-h-16 items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#2D5F5F] bg-[#eef6f6] text-[#2D5F5F] font-black cursor-pointer px-3 text-center">
            <Video className="h-6 w-6 shrink-0" aria-hidden="true" />
            {video ? `${video.name} · ${formatBytes(video.size)}` : (isHe ? 'צלם סרטון' : 'Record video')}
            <input
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              disabled={uploading}
              onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
            />
          </label>
          {video && !uploading && (
            <button type="button" onClick={() => setVideo(null)} className="mt-2 text-sm font-bold text-gray-500 underline">
              {isHe ? 'הסר סרטון' : 'Remove video'}
            </button>
          )}
        </div>

        {/* Damage diagram */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <span className="block font-black text-gray-800 mb-1">{isHe ? 'שרטוט נזקים' : 'Damage diagram'}</span>
          <p className="mb-3 text-sm font-bold text-gray-500">
            {isHe
              ? 'גע בנקודה ברכב שבה יש נזק, בחר סוג, כתוב מה רואים וצלם תמונה.'
              : 'Tap where the damage is, choose the type, add a note and a photo.'}
          </p>
          <CarDamageDiagram
            marks={marks}
            isHe={isHe}
            disabled={uploading || noDamage}
            pending={pending}
            onTap={(view, x, y) => setPending({ view, x, y, kind: null, note: '', photo: null })}
          />

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
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={noDamage}
                disabled={uploading}
                onChange={(e) => setNoDamage(e.target.checked)}
              />
              {isHe ? 'אין נזקים ברכב' : 'No damage on the car'}
            </label>
          )}

          {noDamage && marks.length === 0 && !video && (
            <div className="mt-3">
              <p className="mb-2 text-sm font-bold text-gray-600">
                {isHe ? 'בלי סרטון — צלם תמונה מכל צד (חובה):' : 'Without a video — take a photo of each side (required):'}
              </p>
              <div className="grid grid-cols-2 gap-2">
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
            </div>
          )}
        </div>

        {/* Odometer */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <label htmlFor="odometer" className="block font-black text-gray-800 mb-3">
            {isHe ? 'קילומטראז׳ (חובה)' : 'Odometer (required)'}
          </label>
          <input
            id="odometer"
            type="number"
            inputMode="numeric"
            min={0}
            value={odometerKm}
            disabled={uploading}
            onChange={(e) => setOdometerKm(e.target.value)}
            placeholder="0"
            className="w-full min-h-14 rounded-xl border-2 border-gray-200 px-4 text-2xl font-black text-center focus:outline-none focus:border-[#2D5F5F]"
          />
        </div>

        {/* Fuel */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <span className="block font-black text-gray-800 mb-3">{isHe ? 'רמת דלק (חובה)' : 'Fuel level (required)'}</span>
          <div className="grid grid-cols-5 gap-2" dir="ltr">
            {FUEL_TAP_OPTIONS.map((opt) => (
              <button
                key={opt.eighths}
                type="button"
                disabled={uploading}
                onClick={() => setFuelEighths(opt.eighths)}
                className={`min-h-14 rounded-xl border-2 font-black text-base transition-colors ${
                  fuelEighths === opt.eighths
                    ? 'border-[#E8743B] bg-orange-50 text-[#E8743B]'
                    : 'border-gray-200 text-gray-600'
                }`}
                aria-label={isHe ? opt.he : opt.en}
              >
                {opt.symbol}
              </button>
            ))}
          </div>
        </div>

        {/* Optional checklist */}
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
            <span className="text-gray-400">{checklistOpen ? '▲' : '▼'}</span>
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

        {evidence && !uploading && (
          <p className="rounded-xl bg-amber-50 p-3 text-center text-sm font-bold text-amber-800">{evidence}</p>
        )}
        {error && <p className="text-red-600 text-sm text-center">{error}</p>}

        {uploading && <div className="text-center text-sm font-bold text-gray-600">{stageText}</div>}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="w-full min-h-14 rounded-xl bg-[#E8743B] hover:bg-[#d4632a] disabled:opacity-40 text-white font-black text-lg"
        >
          {uploading ? (isHe ? 'שולח...' : 'Sending…') : (isHe ? 'שלח בדיקה ללקוח' : 'Send inspection to customer')}
        </button>
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
              placeholder={isHe ? 'מה רואים? למשל: שריטה 10 ס״מ בדלת' : 'What do you see? e.g. 10cm scratch on door'}
              className="mb-3 w-full rounded-xl border-2 border-gray-200 p-3 text-base focus:outline-none focus:border-[#2D5F5F]"
            />
            <label
              className={`mb-4 flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 font-black cursor-pointer ${
                pending.photo ? 'border-green-500 bg-green-50 text-green-700' : 'border-dashed border-[#2D5F5F] text-[#2D5F5F]'
              }`}
            >
              <Camera className="h-5 w-5" aria-hidden="true" />
              {pending.photo ? (isHe ? '✓ תמונה צורפה (החלף)' : '✓ Photo attached (replace)') : (isHe ? 'צלם תמונה של הנזק' : 'Take a photo of the damage')}
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
