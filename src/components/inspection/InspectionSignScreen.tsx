'use client';

import { useEffect, useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import TurnstileWidget from '@/components/ui/Turnstile';
import SignaturePadField from '@/components/inspection/SignaturePadField';
import CarDamageDiagram from '@/components/inspection/CarDamageDiagram';
import { damageKindLabel, VIEW_LABELS, type DamageView } from '@/lib/inspection-damage';
import { checklistLabel } from '@/lib/inspection-checklist';
import { DECLARATION_HEADINGS } from '@/lib/inspection-declaration';

interface SignData {
  inspectionId: string;
  type: 'pickup' | 'return';
  odometerKm: number;
  fuelLabel: string;
  status: 'awaiting_signature' | 'signed';
  signedAt: string | null;
  customerName: string;
  vehicleName: string;
  licensePlate: string;
  declaration: { he: string; en: string };
  videoReady: boolean;
  hasVideo?: boolean;
  mediaReady?: boolean;
  damageMarks?: Array<{ n: number; view: DamageView; x: number; y: number; kind: string; note: string; hasPhoto: boolean }>;
  noDamage?: boolean;
  sidePhotoViews?: string[];
  checklist?: Array<{ id: string; value: 'ok' | 'bad' }>;
  /** Token for the /insp-video and /insp-photo media routes. */
  mediaToken: string;
  /** Return only: damage recorded at handover (grey). */
  handoverMarks?: Array<{ n: number; view: DamageView; x: number; y: number; kind: string; note: string; hasPhoto: boolean }>;
  handoverMediaToken?: string;
  handoverOdometerKm?: number | null;
  handoverFuelLabel?: string | null;
  handoverSignedAt?: string | null;
}

async function signDataFetcher(url: string): Promise<SignData> {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error === 'expired' ? 'expired' : 'invalid');
  return json.data as SignData;
}

export interface InspectionSignScreenProps {
  /** GET endpoint returning { data: SignData } (null while unknown). */
  dataUrl: string | null;
  /** POST endpoint that records the signature. */
  submitUrl: string;
  /** Extra fields for the POST body (e.g. the customer's link token). */
  submitExtra?: Record<string, unknown>;
  /** Cloudflare Turnstile — on for the public link page, off on the driver's own logged-in phone. */
  requireTurnstile: boolean;
  isHe: boolean;
  /** Text shown after signing. */
  doneText?: string;
  /** Extra content under the success message (e.g. "back to my day"). */
  afterDone?: ReactNode;
  /** Called once the inspection is signed (just now, or already before). */
  onSigned?: () => void;
}

/**
 * Review + e-sign screen for a pickup/return inspection: vehicle details,
 * video, damage diagram and photos, checklist, the declaration and a
 * signature pad. Used by the customer's link page and, in person, on the
 * driver's phone — same content either way, so what's signed is identical.
 */
export default function InspectionSignScreen({
  dataUrl,
  submitUrl,
  submitExtra,
  requireTurnstile,
  isHe,
  doneText,
  afterDone,
  onSigned,
}: InspectionSignScreenProps) {
  const { data, error: loadErrorObj, isLoading: loading } = useSWR(dataUrl, signDataFetcher);
  const loadError = loadErrorObj ? (loadErrorObj as Error).message : '';

  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  const isSigned = done || data?.status === 'signed';
  useEffect(() => {
    if (isSigned) onSigned?.();
  }, [isSigned, onSigned]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signatureDataUrl || !declarationAccepted) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...submitExtra, signatureDataUrl, declarationAccepted, turnstileToken }),
      });
      const json = await res.json().catch(() => ({}));
      // 409 = this inspection was already signed (double tap, retry after a
      // slow response) — the signature is stored, so show success.
      if (res.status === 409 && /נחתמה/.test(String(json?.error ?? ''))) {
        setDone(true);
        return;
      }
      if (!res.ok) {
        setSubmitError(json?.error || (isHe ? 'החתימה נכשלה. נסה שוב.' : 'Signing failed. Try again.'));
        return;
      }
      setDone(true);
    } catch {
      setSubmitError(isHe ? 'החתימה נכשלה. נסה שוב.' : 'Signing failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!dataUrl || loadError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center" dir={isHe ? 'rtl' : 'ltr'}>
        <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {loadError === 'expired'
            ? (isHe ? 'הקישור פג תוקף' : 'This link has expired')
            : (isHe ? 'נדרש קישור אישי' : 'A personal link is required')}
        </h1>
        <p className="text-gray-600">
          {isHe ? 'פנו למשרד לקבלת קישור חדש.' : 'Contact the office for a new link.'}
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-20" aria-busy="true" />;
  }

  if (!data) return null;

  const typeLabel = data.type === 'pickup' ? (isHe ? 'מסירת הרכב' : 'Vehicle handover') : (isHe ? 'החזרת הרכב' : 'Vehicle return');

  if (done || data.status === 'signed') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center" dir={isHe ? 'rtl' : 'ltr'}>
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isHe ? 'נחתם בהצלחה' : 'Signed successfully'}
        </h2>
        <p className="text-gray-600">
          {doneText ?? (isHe ? 'תודה. עותק של המסמך החתום יישלח לכתובת האימייל שלכם.' : 'Thank you. A copy of the signed document will be emailed to you.')}
        </p>
        {afterDone}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900 mb-1">{typeLabel}</h1>
        <p className="text-gray-600 text-sm">{isHe ? 'עברו על מצב הרכב והפרטים, ואשרו בחתימה' : 'Review the car’s condition and details, then sign to confirm'}</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-gray-400">{isHe ? 'לקוח' : 'Customer'}</span><span className="font-bold">{data.customerName}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">{isHe ? 'רכב' : 'Vehicle'}</span><span className="font-bold">{data.vehicleName} <span dir="ltr">{data.licensePlate}</span></span></div>
        {data.type !== 'return' && (
          <>
            <div className="flex justify-between"><span className="text-gray-400">{isHe ? "קילומטראז'" : 'Odometer'}</span><span className="font-bold" dir="ltr">{data.odometerKm.toLocaleString('he-IL')} km</span></div>
            <div className="flex justify-between"><span className="text-gray-400">{isHe ? 'דלק' : 'Fuel'}</span><span className="font-bold">{data.fuelLabel}</span></div>
          </>
        )}
      </div>

      {data.type === 'return' && (() => {
        const baseKm = data.handoverOdometerKm ?? null;
        const driven = baseKm != null ? data.odometerKm - baseKm : null;
        const newCount = data.damageMarks?.length ?? 0;
        const oldCount = data.handoverMarks?.length ?? 0;
        const km = (n: number) => `${n.toLocaleString('he-IL')} ${isHe ? 'ק״מ' : 'km'}`;
        return (
          <div className="mb-5 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <p className="px-5 pt-5 pb-3 font-black text-gray-900">{isHe ? 'סיכום החזרה — השוואה למסירה' : 'Return summary — compared with handover'}</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="px-3 py-2 text-start font-bold" />
                  <th className="px-3 py-2 text-start font-bold">
                    {isHe ? 'במסירה' : 'Handover'}
                    {data.handoverSignedAt ? <span className="block text-xs font-normal">{new Date(data.handoverSignedAt).toLocaleDateString('he-IL')}</span> : null}
                  </th>
                  <th className="px-3 py-2 text-start font-bold">{isHe ? 'בהחזרה' : 'Return'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <th className="px-3 py-3 text-start font-bold text-gray-500">{isHe ? "ק״מ" : 'Odometer'}</th>
                  <td className="px-3 py-3" dir="ltr">{baseKm != null ? km(baseKm) : '—'}</td>
                  <td className="px-3 py-3 font-black">
                    <span dir="ltr">{km(data.odometerKm)}</span>
                    {driven != null && driven >= 0 && <span className="block text-xs font-bold text-gray-500">{isHe ? `נסעו ${km(driven)}` : `${km(driven)} driven`}</span>}
                  </td>
                </tr>
                <tr>
                  <th className="px-3 py-3 text-start font-bold text-gray-500">{isHe ? 'דלק' : 'Fuel'}</th>
                  <td className="px-3 py-3">{data.handoverFuelLabel ?? '—'}</td>
                  <td className="px-3 py-3 font-black">{data.fuelLabel}</td>
                </tr>
                <tr>
                  <th className="px-3 py-3 text-start font-bold text-gray-500">{isHe ? 'נזקים' : 'Damage'}</th>
                  <td className="px-3 py-3">{isHe ? `${oldCount} קיימים` : `${oldCount} existing`}</td>
                  <td className={`px-3 py-3 font-black ${newCount ? 'text-red-600' : 'text-green-700'}`}>
                    {newCount ? (isHe ? `${newCount} חדשים` : `${newCount} new`) : (isHe ? 'אין חדשים' : 'None new')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })()}

      {(data.hasVideo ?? true) &&
        (data.videoReady ? (
          <div className="mb-5 overflow-hidden rounded-2xl border border-gray-100 bg-black">
            <video controls playsInline className="w-full max-h-[60vh]" src={`/insp-video/${encodeURIComponent(data.mediaToken)}`} />
          </div>
        ) : (
          <div className="mb-5 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
            {isHe ? 'הסרטון עדיין לא זמין' : 'Video not yet available'}
          </div>
        ))}

      {((data.damageMarks?.length ?? 0) > 0 || (data.handoverMarks?.length ?? 0) > 0) && (
        <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-3 font-black text-gray-900">
            {data.type === 'return'
              ? (data.damageMarks?.length
                  ? (isHe ? `נזקים חדשים שסומנו בהחזרה (${data.damageMarks.length})` : `New damage at return (${data.damageMarks.length})`)
                  : (isHe ? 'לא סומנו נזקים חדשים' : 'No new damage marked'))
              : (isHe ? `נזקים קיימים שסומנו (${data.damageMarks!.length})` : `Existing damage marked (${data.damageMarks!.length})`)}
          </p>
          <CarDamageDiagram marks={data.damageMarks ?? []} ghostMarks={data.handoverMarks ?? []} isHe={isHe} />
          {(data.handoverMarks?.length ?? 0) > 0 && (
            <p className="mt-2 text-xs font-bold text-gray-500">
              {isHe ? 'נקודות אפורות: נזקים שתועדו כבר במסירה.' : 'Grey dots: damage already recorded at handover.'}
            </p>
          )}
          <ol className="mt-4 space-y-3">
            {(data.damageMarks ?? []).map((m) => (
              <li key={m.n} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-black text-white">{m.n}</span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-black text-gray-800">
                    {damageKindLabel(m.kind, isHe)} · <span className="font-bold text-gray-500">{isHe ? VIEW_LABELS[m.view]?.he : VIEW_LABELS[m.view]?.en}</span>
                  </p>
                  {m.note && <p className="text-gray-600 break-words">{m.note}</p>}
                  {m.hasPhoto && (
                    <a href={`/insp-photo/${encodeURIComponent(data.mediaToken)}/mark-${m.n}`} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/insp-photo/${encodeURIComponent(data.mediaToken)}/mark-${m.n}`}
                        alt={isHe ? `נזק ${m.n}` : `Damage ${m.n}`}
                        className="mt-2 max-h-48 rounded-lg border border-gray-200"
                        loading="lazy"
                      />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {data.noDamage && (
        <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-black text-green-800">
          {data.type === 'return' ? (isHe ? 'לא נמצאו נזקים חדשים ברכב.' : 'No new damage found on the car.') : (isHe ? 'לא נמצאו נזקים ברכב.' : 'No damage found on the car.')}
        </div>
      )}

      {(data.sidePhotoViews?.length ?? 0) > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-2">
          {data.sidePhotoViews!.map((v) => (
            <figure key={v} className="overflow-hidden rounded-xl border border-gray-100 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/insp-photo/${encodeURIComponent(data.mediaToken)}/side-${v}`} alt="" className="h-32 w-full object-cover" loading="lazy" />
              <figcaption className="p-1 text-center text-xs font-bold text-gray-500">
                {isHe ? VIEW_LABELS[v as DamageView]?.he : VIEW_LABELS[v as DamageView]?.en}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {(data.checklist?.length ?? 0) > 0 && (
        <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-2 font-black text-gray-900">{isHe ? "צ'קליסט" : 'Checklist'}</p>
          <ul className="divide-y divide-gray-100 text-sm">
            {data.checklist!.map((i) => (
              <li key={i.id} className="flex justify-between py-1.5">
                <span className="text-gray-700">{checklistLabel(i.id, isHe)}</span>
                <span className={`font-black ${i.value === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                  {i.value === 'ok' ? (isHe ? '✓ תקין' : '✓ OK') : (isHe ? '✗ לא תקין' : '✗ Not OK')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-2xl border border-[#B8D8D8] bg-[#eef6f6] p-5">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {(isHe ? data.declaration.he : data.declaration.en).split('\n').map((line, i) => (
              <span key={i}>
                {DECLARATION_HEADINGS.has(line.trim()) ? <strong className="text-base text-gray-900">{line}</strong> : line}
                {'\n'}
              </span>
            ))}
          </p>
          <label className="mt-4 flex min-h-14 items-center gap-3 rounded-xl border-2 border-gray-200 bg-white p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={declarationAccepted}
              onChange={(e) => setDeclarationAccepted(e.target.checked)}
              className="h-6 w-6 shrink-0"
            />
            <span className="text-sm font-bold text-gray-800">
              {isHe ? 'קראתי והבנתי.' : 'I have read and understood.'}
            </span>
          </label>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="font-bold text-gray-800 mb-3">{isHe ? 'חתימה' : 'Signature'}</p>
          <SignaturePadField isHe={isHe} onChange={setSignatureDataUrl} />
        </div>

        {submitError && <p className="text-red-600 text-sm text-center">{submitError}</p>}

        {requireTurnstile && <TurnstileWidget onSuccess={setTurnstileToken} onExpire={() => setTurnstileToken('')} />}

        <button
          type="submit"
          disabled={submitting || !signatureDataUrl || !declarationAccepted || (requireTurnstile && !turnstileToken)}
          className="w-full min-h-14 bg-[#E8743B] hover:bg-[#d4632a] disabled:opacity-40 text-white font-black text-lg rounded-xl transition-colors"
        >
          {submitting ? (isHe ? 'שולח...' : 'Submitting...') : (isHe ? 'חתימה ושליחה' : 'Sign and send')}
        </button>
      </form>
    </div>
  );
}
