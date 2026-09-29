import { fuelEighthsToLabel } from './inspection-storage';

export interface InspectionPdfData {
  inspectionId: string;
  bookingId: string;
  bookingNumber: string;
  customerName: string;
  vehicleName: string;
  licensePlate: string;
  type: 'pickup' | 'return';
  odometerKm: number;
  fuelEighths: number;
  /** Which driver ran the inspection — undefined/null for an admin-created one. */
  driverName?: string | null;
  declarationText: string;
  videoSha256: string;
  signedAt: string;
  signerIp: string;
  /** data: URI of the signature PNG. */
  signatureDataUrl: string;
}

function escapeHtml(str: string): string {
  return str.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

/**
 * The signed inspection PDF — the legal record. Rendered once at signing
 * time (see renderInspectionPdf) and never regenerated, same posture as
 * quote-pdf.ts's comment: what the customer signed and what's archived must
 * never be able to drift apart.
 */
export function generateInspectionPdfHTML(data: InspectionPdfData): string {
  const typeLabel = data.type === 'pickup' ? 'קבלת הרכב' : 'החזרת הרכב';
  const fuelLabel = fuelEighthsToLabel(data.fuelEighths);
  const signedAtIL = new Date(data.signedAt).toLocaleString('he-IL', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Tahoma, sans-serif; color: #0D2B2B; direction: rtl; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 12px; margin: 0 0 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  td, th { padding: 8px 10px; border: 1px solid #d9ecec; font-size: 13px; text-align: right; }
  th { background: #eef6f6; width: 30%; font-weight: 700; }
  .declaration { background: #eef6f6; border: 1px solid #B8D8D8; border-radius: 8px; padding: 14px; font-size: 12px; line-height: 1.6; white-space: pre-wrap; margin-bottom: 18px; }
  .signature-block { display: flex; align-items: flex-end; justify-content: space-between; border-top: 1px solid #d9ecec; padding-top: 14px; }
  .signature-block img { max-width: 260px; max-height: 100px; border-bottom: 1px solid #999; }
  .meta { font-size: 10px; color: #888; margin-top: 16px; direction: ltr; text-align: left; word-break: break-all; }
</style>
</head>
<body>
  <h1>דוח בדיקת רכב חתום — ${typeLabel}</h1>
  <p class="sub">SmartCar — נוצר אוטומטית בעת החתימה</p>

  <table>
    <tr><th>מספר הזמנה</th><td dir="ltr">${escapeHtml(data.bookingNumber)}</td></tr>
    <tr><th>שם הלקוח</th><td>${escapeHtml(data.customerName)}</td></tr>
    <tr><th>רכב</th><td>${escapeHtml(data.vehicleName)} — <span dir="ltr">${escapeHtml(data.licensePlate)}</span></td></tr>
    <tr><th>סוג בדיקה</th><td>${typeLabel}</td></tr>
    <tr><th>קילומטראז'</th><td dir="ltr">${data.odometerKm.toLocaleString('he-IL')} ק"מ</td></tr>
    <tr><th>רמת דלק</th><td>${fuelLabel}</td></tr>
    <tr><th>נהג מבצע הבדיקה</th><td>${escapeHtml(data.driverName || '—')}</td></tr>
  </table>

  <div class="declaration">${escapeHtml(data.declarationText)}</div>

  <div class="signature-block">
    <div>
      <div style="font-size:11px;color:#666;margin-bottom:4px;">חתימת הלקוח</div>
      <img src="${data.signatureDataUrl}" alt="חתימה" />
    </div>
    <div style="font-size:11px;color:#666;text-align:left;">
      נחתם בתאריך: ${signedAtIL}<br />
      כתובת IP: <span dir="ltr">${escapeHtml(data.signerIp)}</span>
    </div>
  </div>

  <p class="meta">
    Inspection ID: ${escapeHtml(data.inspectionId)}<br />
    Video SHA-256: ${escapeHtml(data.videoSha256)}
  </p>
</body>
</html>`;
}
