'use client';

import { useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import TurnstileWidget from '@/components/ui/Turnstile';
import SignaturePadField from '@/components/inspection/SignaturePadField';

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
}

async function signDataFetcher(url: string): Promise<SignData> {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error === 'expired' ? 'expired' : 'invalid');
  return json.data as SignData;
}

function InspectionSignForm() {
  const params = useParams();
  const locale = (params?.locale as string) || 'he';
  const isHe = locale === 'he';
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const { data, error: loadErrorObj, isLoading: loading } = useSWR(
    token ? `/api/inspections/sign?token=${encodeURIComponent(token)}` : null,
    signDataFetcher
  );
  const loadError = loadErrorObj ? (loadErrorObj as Error).message : '';

  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signatureDataUrl || !declarationAccepted) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/inspections/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, signatureDataUrl, declarationAccepted, turnstileToken }),
      });
      const json = await res.json().catch(() => ({}));
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

  if (!token || loadError) {
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

  const typeLabel = data.type === 'pickup' ? (isHe ? 'קבלת הרכב' : 'Vehicle pickup') : (isHe ? 'החזרת הרכב' : 'Vehicle return');

  if (done || data.status === 'signed') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center" dir={isHe ? 'rtl' : 'ltr'}>
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isHe ? 'נחתם בהצלחה' : 'Signed successfully'}
        </h2>
        <p className="text-gray-600">
          {isHe ? 'תודה. עותק של המסמך החתום יישלח לכתובת האימייל שלכם.' : 'Thank you. A copy of the signed document will be emailed to you.'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900 mb-1">{typeLabel}</h1>
        <p className="text-gray-600 text-sm">{isHe ? 'עברו על הסרטון והפרטים, ואשרו בחתימה' : 'Review the video and details, then sign to confirm'}</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-gray-400">{isHe ? 'לקוח' : 'Customer'}</span><span className="font-bold">{data.customerName}</span></div>
        <div className="flex justify-between"><span className="text-gray-400">{isHe ? 'רכב' : 'Vehicle'}</span><span className="font-bold">{data.vehicleName} <span dir="ltr">{data.licensePlate}</span></span></div>
        <div className="flex justify-between"><span className="text-gray-400">{isHe ? "קילומטראז'" : 'Odometer'}</span><span className="font-bold" dir="ltr">{data.odometerKm.toLocaleString('he-IL')} km</span></div>
        <div className="flex justify-between"><span className="text-gray-400">{isHe ? 'דלק' : 'Fuel'}</span><span className="font-bold">{data.fuelLabel}</span></div>
      </div>

      {data.videoReady ? (
        <div className="mb-5 overflow-hidden rounded-2xl border border-gray-100 bg-black">
          <video controls playsInline className="w-full max-h-[60vh]" src={`/insp-video/${encodeURIComponent(token)}`} />
        </div>
      ) : (
        <div className="mb-5 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400">
          {isHe ? 'הסרטון עדיין לא זמין' : 'Video not yet available'}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-2xl border border-[#B8D8D8] bg-[#eef6f6] p-5">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{isHe ? data.declaration.he : data.declaration.en}</p>
          <label className="mt-4 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={declarationAccepted}
              onChange={(e) => setDeclarationAccepted(e.target.checked)}
              className="mt-1 h-4 w-4"
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

        <TurnstileWidget onSuccess={setTurnstileToken} onExpire={() => setTurnstileToken('')} />

        <button
          type="submit"
          disabled={submitting || !signatureDataUrl || !declarationAccepted || !turnstileToken}
          className="w-full min-h-14 bg-[#E8743B] hover:bg-[#d4632a] disabled:opacity-40 text-white font-black text-lg rounded-xl transition-colors"
        >
          {submitting ? (isHe ? 'שולח...' : 'Submitting...') : (isHe ? 'אישור וחתימה' : 'Confirm and sign')}
        </button>
      </form>
    </div>
  );
}

export default function InspectionSignPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-20" aria-busy="true" />}>
      <InspectionSignForm />
    </Suspense>
  );
}
