import { heebo400, heebo700, heebo800, logo_png } from '@/lib/quote-assets';
import { REPORT_BRANCHES, branchByKey } from './branches';
import {
  DAMAGE_ZONES,
  ROAD_LABELS,
  ROAD_TYPES,
  ZONE_LABELS,
  formatPlate,
  insurerName,
  type StoredReport,
} from './schema';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** Numbers, phones, plates and emails always render left-to-right inside Hebrew text. */
const ltr = (v: unknown) => `<bdi dir="ltr">${esc(v)}</bdi>`;
const orDash = (v: unknown) => (String(v ?? '').trim() ? esc(v) : '—');
const ltrOrDash = (v: unknown) => (String(v ?? '').trim() ? ltr(v) : '—');

function heDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

function cell(label: string, value: string, span = 1) {
  return `<div class="c"${span > 1 ? ` style="grid-column: span ${span}"` : ''}><span class="l">${label}</span><span class="v">${value}</span></div>`;
}

const ROAD_ICONS: Record<string, string> = {
  straight: '<path d="M20 2v44M36 2v44"/>',
  intersection: '<path d="M20 2v14H4M36 2v14h16M20 46V32H4M36 46V32h16"/>',
  t_junction: '<path d="M4 10h48M4 26h16v20M52 26H36v20"/>',
  roundabout: '<circle cx="28" cy="24" r="7"/><circle cx="28" cy="24" r="16"/>',
};

export interface PdfImages {
  photos: string[]; // signed URLs
  licensePhoto?: string;
  docsPhoto?: string;
  signature: string; // data URL
}

export function generateAccidentReportHTML(id: string, r: StoredReport, img: PdfImages): string {
  const branch = branchByKey(r.branch);
  const sent = new Date(r.submittedAt);
  const sentStr =
    sent.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.') +
    ', ' +
    sent.toLocaleTimeString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
  const box = (on: boolean) => `<span class="box${on ? ' on' : ''}"></span>`;
  const exp = r.driver.licenseExpiry;
  const zone = (z: (typeof DAMAGE_ZONES)[number], span = false) =>
    `<div class="z${r.damage.zones.includes(z) ? ' on' : ''}${span ? ' s' : ''}">${ZONE_LABELS[z].he}</div>`;
  const zonesText = r.damage.zones.map((z) => ZONE_LABELS[z].he).join(', ');
  const o = r.other;

  const branchLines = REPORT_BRANCHES.map(
    (b) => `<div>${esc(b.addressHe)} · טלפון ${ltr(b.phone)}</div>`,
  ).join('');

  const attachments = [
    r.photos.length ? `${ltr(r.photos.length)} תמונות מהתאונה` : 'לא צורפו תמונות',
    img.licensePhoto ? 'רישיון נהיגה' : '',
    img.docsPhoto ? 'מסמכי צד ג\'' : '',
  ].filter(Boolean).join(' · ');

  const photoTiles = img.photos
    .map((u, i) => `<figure><img src="${esc(u)}" alt=""><figcaption>תמונה ${ltr(i + 1)}</figcaption></figure>`)
    .join('');
  const docTiles = [
    img.licensePhoto ? `<figure><img src="${esc(img.licensePhoto)}" alt=""><figcaption>רישיון נהיגה – ${esc(r.driver.name)}</figcaption></figure>` : '',
    img.docsPhoto ? `<figure><img src="${esc(img.docsPhoto)}" alt=""><figcaption>מסמכי צד ג'</figcaption></figure>` : '',
  ].join('');

  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8">
<style>
@font-face{font-family:'Heebo';font-weight:400;src:url(data:font/ttf;base64,${heebo400}) format('truetype');}
@font-face{font-family:'Heebo';font-weight:700;src:url(data:font/ttf;base64,${heebo700}) format('truetype');}
@font-face{font-family:'Heebo';font-weight:800;src:url(data:font/ttf;base64,${heebo800}) format('truetype');}
@page{size:A4;margin:9mm 11mm 9mm}
*{box-sizing:border-box}
body{margin:0;font-family:'Heebo',sans-serif;color:#14282A;font-size:10pt;line-height:1.4}
bdi{unicode-bidi:isolate}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #2D5F5F;padding-bottom:6px}
.hdr img{height:40px}
.co{font-size:8pt;color:#4A6264;line-height:1.55}
.co b{font-size:13pt;color:#14282A;display:block;margin-bottom:2px}
.title{display:flex;justify-content:space-between;align-items:flex-end;margin:7px 0 6px}
.title h1{margin:0;font-size:18pt;font-weight:800;color:#2D5F5F}
.meta{font-size:9pt;color:#4A6264;text-align:left}
.meta b{color:#14282A;font-weight:700}
.sec{border:1px solid #C9D6D6;border-radius:8px;margin-bottom:6px;overflow:hidden;break-inside:avoid}
.sec h2{margin:0;background:#E6EFEF;color:#2D5F5F;font-size:10.5pt;font-weight:700;padding:3px 11px}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
.grid.g3{grid-template-columns:repeat(3,minmax(0,1fr))}
.c{padding:3px 11px;border-top:1px solid #EEF1F1}
.l{font-size:8pt;color:#5B7072;display:block}
.v{font-size:10pt;font-weight:500;white-space:pre-wrap;word-break:break-word}
.roads{display:flex;gap:8px;padding:5px 11px;border-top:1px solid #EEF1F1}
.road{flex:1;border:1px solid #C9D6D6;border-radius:6px;text-align:center;padding:3px 0 2px;font-size:8.5pt;color:#5B7072}
.road.on{border:2px solid #2D5F5F;background:#E6EFEF;color:#2D5F5F;font-weight:700}
.road svg{display:block;margin:0 auto 2px}
.box{display:inline-block;width:11px;height:11px;border:1.3px solid #5B7072;border-radius:2px;vertical-align:-1px;margin-left:3px}
.box.on{background:#2D5F5F;border-color:#2D5F5F}
.dmg{display:flex;gap:14px;padding:7px 11px;border-top:1px solid #EEF1F1;align-items:flex-start}
.car{width:124px;flex:none;background:#EEF3F3;border-radius:36px 36px 24px 24px;padding:6px;display:grid;grid-template-columns:36px 1fr 36px;gap:3px}
.z{border:1px solid #C9D6D6;background:#fff;border-radius:4px;font-size:6.5pt;text-align:center;padding:2px 1px;line-height:1.15}
.z.on{background:#2D5F5F;color:#fff;border-color:#2D5F5F;font-weight:700}
.z.s{grid-column:1/-1}
.sig{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;padding:6px 11px;border-top:1px solid #EEF1F1}
.sigbox{width:190px;height:60px;border-bottom:1.5px solid #14282A;display:flex;align-items:flex-end;justify-content:center}
.sigbox img{max-width:190px;max-height:58px}
.pb{break-before:page}
.ph{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:10px 11px;border-top:1px solid #EEF1F1}
figure{margin:0;break-inside:avoid}
figure img{width:100%;height:230px;object-fit:contain;background:#EEF3F3;border-radius:6px;display:block}
figcaption{font-size:8.5pt;color:#5B7072;margin-top:3px}
.foot{margin-top:10px;font-size:8pt;color:#7A9294;border-top:1px solid #E1E8E8;padding-top:5px}
</style></head><body>
<div class="hdr">
<div class="co"><b>סמארטקאר השכרת רכב</b>${branchLines}</div>
<img src="data:image/png;base64,${logo_png}" alt="SmartCar">
</div>

<div class="title"><h1>דו"ח תאונה</h1>
<div class="meta">מספר דו"ח <b>${ltr(id)}</b><br>נשלח <b>${ltr(sentStr)}</b>${branch ? ` · סניף <b>${esc(branch.nameHe)}</b>` : ''} · שפת מילוי <b>${r.locale === 'en' ? 'אנגלית' : 'עברית'}</b></div></div>

<div class="sec"><h2>רכב סמארט קאר</h2><div class="grid g3">
${cell('מספר רכב', ltr(formatPlate(r.car.plate)))}${cell('דגם', esc(r.car.model), 2)}
</div></div>

<div class="sec"><h2>פרטי הנהג</h2><div class="grid">
${cell('שם הנהג', esc(r.driver.name))}${cell(r.driver.idType === 'passport' ? 'דרכון' : 'ת.ז.', ltr(r.driver.idNumber))}${cell('טלפון', ltr(r.driver.phone))}${cell('מספר רישיון', ltr(r.driver.licenseNumber))}
${cell('תוקף רישיון', ltr(`${exp.d.padStart(2, '0')}.${exp.m.padStart(2, '0')}.${exp.y}`))}${cell('מייל', ltrOrDash(r.driver.email))}${cell('כתובת מגורים', esc(r.driver.address), 2)}
</div></div>

<div class="sec"><h2>פרטי התאונה</h2><div class="grid g3">
${cell('תאריך התאונה', ltr(heDate(r.accident.date)))}${cell('שעת התאונה', ltr(r.accident.time))}${cell('מקום התאונה', esc(r.accident.location))}
</div>
<div class="roads">${ROAD_TYPES.map(
    (t) => `<div class="road${r.accident.roadType === t ? ' on' : ''}"><svg width="26" height="18" viewBox="0 0 56 48" fill="none" stroke="currentColor" stroke-width="3">${ROAD_ICONS[t]}</svg>${ROAD_LABELS[t].he}</div>`,
  ).join('')}</div>
${cell('כיצד אירעה התאונה', esc(r.accident.description))}
<div class="grid">
${cell('האם היו נפגעים', `${box(r.accident.injured)}כן &nbsp; ${box(!r.accident.injured)}לא`)}
${cell('טופל ע"י משטרה', `${box(r.accident.police)}כן &nbsp; ${box(!r.accident.police)}לא`)}
${cell('תחנה', r.accident.police ? orDash(r.accident.policeStation) : '—')}
${cell('מס\' יומן', r.accident.police ? ltrOrDash(r.accident.policeReport) : '—')}
</div></div>

<div class="sec"><h2>פרטי צד ג'</h2>${
    o.involved
      ? `<div class="grid">
${cell('מספר רכב', ltr(formatPlate(o.plate)))}${cell('סוג ודגם הרכב', esc(o.model))}${cell('חברת ביטוח', esc(insurerName(o)))}${cell('מספר פוליסה', ltr(o.policy))}
${cell('שם בעל הרכב', esc(o.ownerName))}${cell(o.ownerIdType === 'passport' ? 'דרכון בעל הרכב' : 'ת.ז. בעל הרכב', ltr(o.ownerId))}${cell('טלפון', o.ownerPhone ? ltr(o.ownerPhone) : '—')}${cell('שם סוכן', orDash(o.agent))}
${cell('כתובת', esc(o.ownerAddress), 4)}
</div>`
      : `<div class="c"><span class="v">לא היה רכב נוסף מעורב בתאונה.</span></div>`
  }</div>

<div class="sec"><h2>נזקים</h2><div class="dmg">
<div class="car">${zone('front', true)}${zone('front_right')}${zone('hood')}${zone('front_left')}${zone('rear_right')}${zone('roof')}${zone('rear_left')}${zone('trunk', true)}${zone('rear', true)}</div>
<div style="flex:1;display:flex;flex-direction:column;gap:6px">
<div><span class="l">נזק לרכב סמארט קאר</span><span class="v">${zonesText ? esc(zonesText) + ' · ' : ''}${esc(r.damage.ours)}</span></div>
<div><span class="l">נזק לצד ג'</span><span class="v">${o.involved ? orDash(r.damage.theirs) : '—'}</span></div>
<div><span class="l">קבצים מצורפים (בעמוד הבא)</span><span class="v">${attachments}</span></div>
</div></div></div>

<div class="sec"><h2>הצהרה וחתימה</h2><div class="sig">
<div>${box(true)} אני מצהיר/ה בזאת שכל הפרטים שמסרתי נכונים.<br><span class="l">נחתם דיגיטלית · ${ltr(sentStr)}</span></div>
<div style="text-align:center"><div class="sigbox"><img src="${esc(img.signature)}" alt=""></div><span class="l">חתימת הנהג · ${esc(r.driver.name)}</span></div>
</div></div>

${photoTiles || docTiles ? `<div class="pb"></div>
<div class="title" style="margin-top:0"><h1 style="font-size:16pt">תמונות ומסמכים מצורפים</h1><div class="meta">דו"ח <b>${ltr(id)}</b></div></div>
${photoTiles ? `<div class="sec"><h2>תמונות מהתאונה</h2><div class="ph">${photoTiles}</div></div>` : ''}
${docTiles ? `<div class="sec"><h2>מסמכים</h2><div class="ph">${docTiles}</div></div>` : ''}` : ''}
<div class="foot">הדו"ח הופק אוטומטית מהטופס הדיגיטלי של סמארט קאר · ${ltr('smartcar.co.il')} · ${ltr('office@smartcar.co.il')}</div>
</body></html>`;
}

/** Renders HTML to a PDF buffer with the same headless Chromium setup as the quote PDF. */
export async function renderPdf(html: string): Promise<Buffer> {
  const [{ default: puppeteer }, { default: chromium }] = await Promise.all([
    import('puppeteer-core'),
    import('@sparticuz/chromium'),
  ]);
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load', timeout: 20000 });
    // Photos come from signed storage URLs — wait for every one before printing.
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images).map((img) =>
          img.complete ? Promise.resolve() : new Promise((res) => { img.onload = res; img.onerror = res; }),
        ),
      );
      if (document.fonts?.ready) await document.fonts.ready;
    });
    const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}
