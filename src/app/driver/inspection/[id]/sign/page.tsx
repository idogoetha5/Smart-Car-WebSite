'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { MessageCircle, Smartphone } from 'lucide-react';
import { fetcher } from '@/lib/swr';
import { onTheWayLink, signedCopyMessage } from '@/lib/driver-on-the-way';
import InspectionSignScreen from '@/components/inspection/InspectionSignScreen';

/**
 * In-person signing: after the driver submits the inspection, the phone is
 * handed to the customer, who reviews everything (details, video, damage
 * diagram, photos, checklist, declaration) and signs here. On "send" the
 * signed PDF is emailed to the customer and the office.
 */
export default function DriverInspectionSignPage() {
  const params = useParams();
  const id = params?.id as string;

  const [linkState, setLinkState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [linkError, setLinkError] = useState('');
  const [signed, setSigned] = useState(false);

  const sendLink = async () => {
    setLinkState('sending');
    setLinkError('');
    try {
      const res = await fetch(`/api/driver/inspections/${encodeURIComponent(id)}/send-link`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.signLinkSent === false) {
        setLinkError(json?.error || 'שליחת המייל נכשלה');
        setLinkState('error');
        return;
      }
      setLinkState('sent');
    } catch {
      setLinkError('שליחת המייל נכשלה');
      setLinkState('error');
    }
  };

  const dataUrl = id ? `/api/driver/inspections/${encodeURIComponent(id)}/sign` : null;
  // Separate cache key from the sign screen's own fetch (different response shape).
  const { data: view } = useSWR<{ data: { customerName: string; customerPhone?: string; signedPdfUrl?: string; type: 'pickup' | 'return' } }>(
    dataUrl ? `${dataUrl}?for=share` : null,
    fetcher
  );
  const v = view?.data;
  const whatsappCopy =
    v?.customerPhone && v.signedPdfUrl
      ? onTheWayLink(v.customerPhone, signedCopyMessage({ customerName: v.customerName, type: v.type, pdfUrl: v.signedPdfUrl }))
      : null;

  const backHome = (
    <Link
      href="/driver"
      className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2D5F5F] px-6 font-black text-white"
    >
      חזרה ל״היום שלי״
    </Link>
  );

  if (linkState === 'sent') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center" dir="rtl">
        <h1 className="text-2xl font-black text-gray-900 mb-2">נשלח קישור ללקוח</h1>
        <p className="text-gray-600">הלקוח יקבל במייל קישור לצפייה ולחתימה. כשיחתום, הטופס החתום יישלח אליו ולמשרד.</p>
        {backHome}
      </div>
    );
  }

  return (
    <div dir="rtl">
      {!signed && (<div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center gap-3 rounded-2xl bg-[#eef6f6] p-4 text-[#2D5F5F]">
          <Smartphone className="h-6 w-6 shrink-0" aria-hidden="true" />
          <p className="text-sm font-black">העבר את הטלפון ללקוח: הוא עובר על הבדיקה, מאשר את ההצהרה וחותם.</p>
        </div>
      </div>)}

      <InspectionSignScreen
        dataUrl={dataUrl}
        submitUrl={`/api/driver/inspections/${encodeURIComponent(id)}/sign`}
        requireTurnstile={false}
        isHe
        doneText="תודה! הטופס החתום נשלח למייל של הלקוח ולמשרד."
        afterDone={
          <div className="mt-6 flex flex-col items-center gap-3">
            {whatsappCopy && (
              <a
                href={whatsappCopy}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 font-black text-white"
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                שלח ללקוח את הטופס החתום בוואטסאפ
              </a>
            )}
            {backHome}
          </div>
        }
        onSigned={() => setSigned(true)}
      />

      {!signed && (<div className="max-w-2xl mx-auto px-4 pb-10 text-center">
        <button
          type="button"
          onClick={sendLink}
          disabled={linkState === 'sending'}
          className="text-sm font-bold text-gray-500 underline disabled:opacity-50"
        >
          {linkState === 'sending' ? 'שולח…' : 'הלקוח לא נמצא? שלח לו קישור לחתימה במייל'}
        </button>
        {linkState === 'error' && <p className="mt-2 text-sm text-red-600">{linkError}</p>}
      </div>)}
    </div>
  );
}
