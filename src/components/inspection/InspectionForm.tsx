'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, CheckCircle2 } from 'lucide-react';
import { FUEL_TAP_OPTIONS } from '@/lib/inspection-storage';

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
 * Video/odometer/fuel capture + resumable upload, shared by the admin
 * inspection flow (Daniel logged in as admin) and the driver app (a driver
 * logged in with their own PIN) — same component, different apiBase, so
 * the two never drift into two different flows.
 */
export default function InspectionForm({ apiBase, bookingId, type, isHe, statusHref }: InspectionFormProps) {
  const router = useRouter();

  const [video, setVideo] = useState<File | null>(null);
  const [odometerKm, setOdometerKm] = useState('');
  const [fuelEighths, setFuelEighths] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'idle' | 'creating' | 'uploading' | 'finishing' | 'done'>('idle');
  const [error, setError] = useState('');
  const [inspectionId, setInspectionId] = useState('');
  const [signLink, setSignLink] = useState('');

  const canSubmit = Boolean(video) && odometerKm.trim() !== '' && fuelEighths !== null && !uploading;

  const handleSubmit = async () => {
    if (!video || fuelEighths === null || !bookingId) return;
    setUploading(true);
    setError('');
    setStage('creating');

    try {
      const createRes = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          type,
          odometerKm: Number(odometerKm),
          fuelEighths,
          videoExt: extOf(video),
        }),
      });
      const created = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(created?.error || 'Failed to start inspection');

      setInspectionId(created.inspectionId);
      setStage('uploading');

      const tus = await import('tus-js-client');
      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(video, {
          endpoint: created.uploadEndpoint,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          chunkSize: 6 * 1024 * 1024,
          headers: {
            authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
            'x-upsert': 'true',
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          metadata: {
            bucketName: created.bucket,
            objectName: created.path,
            contentType: video.type || 'video/mp4',
          },
          onError: (err) => reject(err),
          onProgress: (uploaded, total) => setProgress(Math.round((uploaded / total) * 100)),
          onSuccess: () => resolve(),
        });
        upload.findPreviousUploads().then((previous) => {
          if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
          upload.start();
        });
      });

      setStage('finishing');
      const completeRes = await fetch(`${apiBase}/${created.inspectionId}/complete`, { method: 'POST' });
      const completed = await completeRes.json().catch(() => ({}));
      if (!completeRes.ok) throw new Error(completed?.error || 'Failed to finish inspection');

      setSignLink(completed.signLink ?? '');
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
        <p className="text-gray-600 mb-6">
          {isHe ? 'קישור לחתימה נשלח ללקוח.' : 'A signing link was sent to the customer.'}
        </p>
        <button
          onClick={() => router.push(statusHref(inspectionId, signLink))}
          className="min-h-12 px-6 rounded-xl bg-[#E8743B] hover:bg-[#d4632a] text-white font-black"
        >
          {isHe ? 'מעקב אחר סטטוס' : 'Track status'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8" dir={isHe ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-black text-gray-900 mb-1">
        {type === 'pickup' ? (isHe ? 'בדיקת קבלת רכב' : 'Pickup inspection') : (isHe ? 'בדיקת החזרת רכב' : 'Return inspection')}
      </h1>
      <p className="text-gray-500 text-sm mb-6" dir="ltr">{bookingId}</p>

      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <label className="block font-black text-gray-800 mb-2">
            {isHe ? 'סרטון חובה: סביב הרכב ופנים הרכב' : 'Required video: exterior and interior'}
          </label>
          <p className="mb-3 text-sm font-bold text-gray-500">
            {isHe
              ? 'יש לצלם ברצף סיור מלא סביב הרכב, פנים הרכב, לוח הקילומטראז׳ ומד הדלק.'
              : 'Record one continuous video of the full exterior, interior, odometer and fuel gauge.'}
          </p>
          <label className="flex min-h-16 items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#2D5F5F] bg-[#eef6f6] text-[#2D5F5F] font-black cursor-pointer">
            <Video className="h-6 w-6" aria-hidden="true" />
            {video ? `${video.name} · ${formatBytes(video.size)}` : (isHe ? 'הקלט סרטון חובה' : 'Record required video')}
            <input
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              disabled={uploading}
              onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

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

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <span className="block font-black text-gray-800 mb-3">{isHe ? 'רמת דלק (חובה)' : 'Fuel level (required)'}</span>
          <div className="grid grid-cols-5 gap-2">
            {FUEL_TAP_OPTIONS.map((opt) => (
              <button
                key={opt.eighths}
                type="button"
                disabled={uploading}
                onClick={() => setFuelEighths(opt.eighths)}
                className={`min-h-16 rounded-xl border-2 font-black text-lg transition-colors ${
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

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}

        {uploading && (
          <div className="text-center text-sm font-bold text-gray-600">
            {stage === 'uploading'
              ? `${isHe ? 'מעלה סרטון' : 'Uploading video'}… ${progress}%`
              : isHe ? 'מסיים...' : 'Finishing…'}
          </div>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="w-full min-h-14 rounded-xl bg-[#E8743B] hover:bg-[#d4632a] disabled:opacity-40 text-white font-black text-lg"
        >
          {uploading ? (isHe ? 'שולח...' : 'Sending…') : (isHe ? 'שלח בדיקה' : 'Submit inspection')}
        </button>
      </div>
    </div>
  );
}
