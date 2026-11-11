import { Resend } from 'resend';
import { OFFICE_EMAIL } from '@/lib/constants';
import { branchByKey } from './branches';
import { ROAD_LABELS, ZONE_LABELS, formatPlate, insurerName, type StoredReport } from './schema';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
const ltr = (v: unknown) => `<bdi dir="ltr" style="unicode-bidi:isolate">${esc(v)}</bdi>`;

const FROM = `SmartCar <${OFFICE_EMAIL}>`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://smartcar.co.il';

function heDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function row(label: string, value: string) {
  return `<tr><td style="padding:6px 0;color:#5B7072;width:140px;vertical-align:top">${label}</td><td style="padding:6px 0;font-weight:500">${value}</td></tr>`;
}

function officeHtml(id: string, r: StoredReport) {
  const branch = branchByKey(r.branch);
  const o = r.other;
  return `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;color:#14282A;max-width:640px;margin:0 auto;font-size:15px;line-height:1.5">
<h1 style="color:#2D5F5F;font-size:22px;margin:0 0 4px">דו"ח תאונה חדש ${ltr(id)}</h1>
<p style="margin:0 0 16px;color:#5B7072">הדו"ח המלא, כולל חתימה ותמונות, מצורף כקובץ PDF.</p>
<div style="background:#E6EFEF;border-radius:10px;padding:12px 16px;margin-bottom:16px">
<b>תקציר:</b> רכב ${ltr(formatPlate(r.car.plate))} (${esc(r.car.model)}) · ${esc(r.driver.name)} · ${ltr(heDate(r.accident.date))} ${ltr(r.accident.time)} · ${esc(r.accident.location)}<br>
צד ג': <b>${o.involved ? 'כן' : 'לא'}</b> · נפגעים: <b>${r.accident.injured ? 'כן' : 'לא'}</b> · משטרה: <b>${r.accident.police ? 'כן' : 'לא'}</b>${branch ? ` · סניף ${esc(branch.nameHe)}` : ''}
</div>
<h2 style="font-size:17px;color:#2D5F5F;margin:16px 0 4px">פרטי הנהג</h2>
<table style="width:100%;border-collapse:collapse">
${row('שם', esc(r.driver.name))}${row(r.driver.idType === 'passport' ? 'דרכון' : 'ת.ז.', ltr(r.driver.idNumber))}${row('טלפון', `<a href="tel:${esc(r.driver.phone)}">${ltr(r.driver.phone)}</a>`)}
${row('כתובת', esc(r.driver.address))}${row('רישיון', `${ltr(r.driver.licenseNumber)} · בתוקף עד ${ltr(`${r.driver.licenseExpiry.d}.${r.driver.licenseExpiry.m}.${r.driver.licenseExpiry.y}`)}`)}
</table>
<h2 style="font-size:17px;color:#2D5F5F;margin:16px 0 4px">התאונה</h2>
<table style="width:100%;border-collapse:collapse">
${row('סוג הדרך', ROAD_LABELS[r.accident.roadType].he)}${row('תיאור', esc(r.accident.description))}
${r.accident.police ? row('משטרה', `${esc(r.accident.policeStation)} · יומן ${ltr(r.accident.policeReport)}`) : ''}
${row('נזק לרכב שלנו', `${esc(r.damage.zones.map((z) => ZONE_LABELS[z].he).join(', '))}${r.damage.zones.length ? ' · ' : ''}${esc(r.damage.ours)}`)}
</table>
${
  o.involved
    ? `<h2 style="font-size:17px;color:#2D5F5F;margin:16px 0 4px">צד ג'</h2>
<table style="width:100%;border-collapse:collapse">
${row('רכב', `${ltr(formatPlate(o.plate))} · ${esc(o.model)}`)}${row('ביטוח', `${esc(insurerName(o))} · פוליסה ${ltr(o.policy)}`)}
${row('בעל הרכב', `${esc(o.ownerName)} · ${o.ownerIdType === 'passport' ? 'דרכון' : 'ת.ז.'} ${ltr(o.ownerId)}`)}${row('טלפון', o.ownerPhone ? ltr(o.ownerPhone) : '—')}${row('כתובת', esc(o.ownerAddress))}
${row('נזק לרכב שלו', esc(r.damage.theirs))}
</table>`
    : ''
}
<p style="margin-top:24px"><a href="${APP_URL}/he/admin/accident-reports?id=${encodeURIComponent(id)}" style="background:#2D5F5F;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold;display:inline-block">פתיחת הדו"ח בממשק הניהול</a></p>
</div>`;
}

function customerHtml(id: string, r: StoredReport) {
  if (r.locale === 'en') {
    return `<div style="font-family:Arial,Helvetica,sans-serif;color:#14282A;max-width:560px;margin:0 auto;font-size:15px;line-height:1.5">
<h1 style="color:#2D5F5F;font-size:22px">Your accident report has been received</h1>
<p>Thank you, ${esc(r.driver.name)}. Report number <b>${esc(id)}</b> has reached the SmartCar office. A copy is attached to this email.</p>
<p>If anything is missing, we'll get in touch.</p><p>SmartCar</p></div>`;
  }
  return `<div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;color:#14282A;max-width:560px;margin:0 auto;font-size:15px;line-height:1.5">
<h1 style="color:#2D5F5F;font-size:22px">דו"ח התאונה שלך התקבל</h1>
<p>תודה, ${esc(r.driver.name)}. דו"ח מספר ${ltr(id)} הגיע למשרד סמארט קאר. עותק מצורף למייל הזה.</p>
<p>אם יחסר משהו, נחזור אליך.</p><p>סמארט קאר</p></div>`;
}

export async function sendReportEmails(
  id: string,
  r: StoredReport,
  pdf: Buffer,
  recipients: string[],
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('[accident-report] RESEND_API_KEY missing — email not sent for', id);
    return false;
  }
  const resend = new Resend(key);
  const attachment = { filename: `SmartCar-accident-report-${id}.pdf`, content: pdf };
  const subject = `דו"ח תאונה ${id} | רכב ${formatPlate(r.car.plate)} | ${r.driver.name} | ${heDate(r.accident.date)}`;

  const office = await resend.emails.send({
    from: FROM,
    to: recipients,
    subject,
    html: officeHtml(id, r),
    replyTo: r.driver.email || undefined,
    attachments: [attachment],
  });
  if (office.error) {
    console.error('[accident-report] office email failed:', office.error);
    return false;
  }

  if (r.driver.email) {
    const customer = await resend.emails.send({
      from: FROM,
      to: [r.driver.email],
      subject: r.locale === 'en' ? `Your SmartCar accident report ${id}` : `דו"ח התאונה שלך ${id} – סמארט קאר`,
      html: customerHtml(id, r),
      attachments: [attachment],
    });
    if (customer.error) console.error('[accident-report] customer email failed:', customer.error);
  }
  return true;
}
