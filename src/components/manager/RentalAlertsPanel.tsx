'use client';

import { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Droplets, Gauge, History, ShieldCheck, Wrench } from 'lucide-react';
import { fuelEighthsToLabel } from '@/lib/inspection-storage';
import { damageKindLabel, VIEW_LABELS } from '@/lib/inspection-damage';
import type { RentalAlert } from '@/lib/rental-alerts';
import { useManager } from './ManagerData';

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function mileageRule(days: number): string {
  if (days <= 7) return `${days} ימים × 200 ק״מ`;
  if (days <= 30) return `${days} ימים × 220 ק״מ`;
  return `${Math.ceil(days / 30)} תקופות × 2,500 ק״מ`;
}

function AlertCard({ alert, historical = false }: { alert: RentalAlert; historical?: boolean }) {
  const { setRentalAlertResolved } = useManager();
  const resolved = Boolean(alert.resolvedAt);
  const muted = historical || resolved;

  return (
    <article className={`rounded-3xl p-4 ring-1 sm:p-5 ${muted ? 'bg-gray-50 text-gray-600 ring-gray-200' : 'bg-white ring-red-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-base font-black ${muted ? 'text-gray-700' : 'text-[#0D2B2B]'}`}>
            {alert.vehicleName || 'רכב'} {alert.licensePlate ? <span dir="ltr">· {alert.licensePlate}</span> : null}
          </p>
          <p className="mt-0.5 text-sm">{alert.customerName || 'לקוח לא צוין'} · החזרה {shortDate(alert.signedAt)}</p>
        </div>
        {resolved ? (
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-gray-200 px-3 text-xs font-black text-gray-700">
            <Check className="h-4 w-4" aria-hidden="true" /> טופל
          </span>
        ) : historical ? (
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-gray-200 px-3 text-xs font-black text-gray-700">
            <History className="h-4 w-4" aria-hidden="true" /> השכרה קודמת
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {alert.kinds.includes('mileage') && (
          <div className={`rounded-2xl p-3 ${muted ? 'bg-gray-100' : 'bg-red-50 text-red-800'}`}>
            <p className="flex items-center gap-2 text-sm font-black"><Gauge className="h-4 w-4" aria-hidden="true" /> חריגת קילומטראז׳</p>
            <p className="mt-1 text-sm">נסע {alert.distanceKm.toLocaleString('he-IL')} ק״מ מתוך מכסה של {alert.allowedKm.toLocaleString('he-IL')} ק״מ</p>
            <p className="text-xs">{mileageRule(alert.rentalDays)}</p>
            <p className="mt-1 text-sm font-black">חריגה: {alert.excessKm.toLocaleString('he-IL')} ק״מ</p>
          </div>
        )}
        {alert.kinds.includes('odometer') && (
          <div className={`rounded-2xl p-3 ${muted ? 'bg-gray-100' : 'bg-red-50 text-red-800'}`}>
            <p className="flex items-center gap-2 text-sm font-black"><Gauge className="h-4 w-4" aria-hidden="true" /> קריאת קילומטראז׳ דורשת בדיקה</p>
            <p className="mt-1 text-sm">בהחזרה נרשמה קריאה נמוכה מהמסירה: {alert.pickupOdometerKm.toLocaleString('he-IL')} ← {alert.returnOdometerKm.toLocaleString('he-IL')}</p>
          </div>
        )}
        {alert.kinds.includes('fuel') && (
          <div className={`rounded-2xl p-3 ${muted ? 'bg-gray-100' : 'bg-amber-50 text-amber-900'}`}>
            <p className="flex items-center gap-2 text-sm font-black"><Droplets className="h-4 w-4" aria-hidden="true" /> דלק חסר</p>
            <p className="mt-1 text-sm">נמסר עם {fuelEighthsToLabel(alert.pickupFuelEighths)}, הוחזר עם {fuelEighthsToLabel(alert.returnFuelEighths)} — הפרש של {alert.fuelMissingEighths}/8 מיכל</p>
          </div>
        )}
        {alert.kinds.includes('damage') && (
          <div className={`rounded-2xl p-3 ${muted ? 'bg-gray-100' : 'bg-red-50 text-red-800'}`}>
            <p className="flex items-center gap-2 text-sm font-black"><Wrench className="h-4 w-4" aria-hidden="true" /> {alert.newDamages.length} נזקים חדשים</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {alert.newDamages.slice(0, 4).map((damage, index) => (
                <li key={`${damage.view}-${damage.n}-${index}`}>{VIEW_LABELS[damage.view]?.he ?? damage.view} · {damageKindLabel(damage.kind)}{damage.note ? ` — ${damage.note}` : ''}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {alert.pdfUrl && <a href={alert.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-2xl px-4 text-sm font-black text-[#2D5F5F] ring-1 ring-[#B8D8D8]">מסמך חתום</a>}
        {alert.videoUrl && <a href={alert.videoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-2xl px-4 text-sm font-black text-[#2D5F5F] ring-1 ring-[#B8D8D8]">סרטון הבדיקה</a>}
        {!historical && !resolved && (
          <button
            onClick={() => void setRentalAlertResolved(alert, true)}
            className="ms-auto inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[#2D5F5F] px-5 text-sm font-black text-white"
          >
            <Check className="h-4 w-4" aria-hidden="true" /> סמן כטופל
          </button>
        )}
      </div>
      {resolved && <p className="mt-3 text-xs text-gray-500">טופל בתאריך {shortDate(alert.resolvedAt as string)}{alert.resolvedBy ? ` על ידי ${alert.resolvedBy}` : ''}</p>}
    </article>
  );
}

export default function RentalAlertsPanel() {
  const { rentalAlerts } = useManager();
  const [historyOpen, setHistoryOpen] = useState(false);
  const current = rentalAlerts.filter((alert) => alert.isLatestRental && !alert.resolvedAt);
  const history = rentalAlerts.filter((alert) => !alert.isLatestRental || alert.resolvedAt);
  if (!current.length && !history.length) return null;

  return (
    <section className="mb-6" aria-labelledby="rental-alerts-heading">
      <div className={`rounded-3xl p-4 ring-1 sm:p-5 ${current.length ? 'bg-red-50/70 ring-red-200' : 'bg-white ring-black/[0.04]'}`}>
        <div className="flex items-start gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${current.length ? 'bg-red-100 text-red-700' : 'bg-[#eef6f6] text-[#2D5F5F]'}`}>
            {current.length ? <AlertTriangle className="h-5 w-5" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="rental-alerts-heading" className="text-lg font-black text-[#0D2B2B]">חריגות ונזקים מההשכרה האחרונה</h2>
            <p className="mt-0.5 text-sm text-gray-600">השוואה אוטומטית בין המסירה להחזרה: קילומטראז׳, דלק ונזקים חדשים.</p>
          </div>
          {current.length > 0 && <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-black text-white tabular-nums">{current.length}</span>}
        </div>

        {current.length ? (
          <div className="mt-4 space-y-3">{current.map((alert) => <AlertCard key={alert.id} alert={alert} />)}</div>
        ) : (
          <p className="mt-4 rounded-2xl bg-[#eef6f6] p-3 text-sm font-bold text-[#2D5F5F]">אין כרגע חריגות פתוחות מההשכרה האחרונה.</p>
        )}

        {history.length > 0 && (
          <div className="mt-4 border-t border-black/5 pt-3">
            <button
              type="button"
              onClick={() => setHistoryOpen((open) => !open)}
              aria-expanded={historyOpen}
              className="flex min-h-11 w-full items-center justify-between rounded-2xl px-3 text-sm font-black text-gray-700 hover:bg-black/[0.03]"
            >
              <span className="flex items-center gap-2"><History className="h-4 w-4" aria-hidden="true" /> היסטוריית חריגות ({history.length})</span>
              <ChevronDown className={`h-5 w-5 transition ${historyOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {historyOpen && <div className="mt-3 space-y-3">{history.map((alert) => <AlertCard key={alert.id} alert={alert} historical />)}</div>}
          </div>
        )}
      </div>
    </section>
  );
}
