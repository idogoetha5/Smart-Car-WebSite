export interface QuoteVehicle {
  name: string;
  subtitle: string;
  trim: string;
  year: string;
  listPrice: number;
  downPayment: number;
  monthlyPrice: number;
  months: number;
  annualKm: number;
  imageUrl: string;
}

export interface QuoteData {
  quoteNumber: string;
  date: string;
  validUntil?: string;
  customerName: string;
  customerEmail: string;
  companyName: string;
  companyId: string;
  vehicles: QuoteVehicle[];
}

const VAT = 1.18;

function fmt(n: number) {
  return n ? n.toLocaleString('he-IL') : '—';
}

function addDays(dateStr: string, days: number): string {
  // todayIL() (and the date field in general) formats as DD.MM.YYYY, not DD/MM/YYYY
  const [d, m, y] = dateStr.split(/[./]/).map(Number);
  if (!d || !m || !y) return '—';
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return dt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function generateQuoteHTML(data: QuoteData, appOrigin = ''): string {
  const logoUrl = appOrigin
    ? `${appOrigin}/images/logo.png`
    : '/images/logo.png';

  const validUntil = data.validUntil ?? (data.date ? addDays(data.date, 30) : '—');

  const activeVehicles = data.vehicles.filter((v) => v.name);
  const carsClass = activeVehicles.length === 1 ? 'cars single' : 'cars';

  const SVG_CAR = `<svg class="ph" viewBox="0 0 220 86" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#6f7d76" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 58h192"/>
    <path d="M28 58c-3-15 3-25 16-29 8-2 14-9 24-11 14-3 30-2 44 3 7 3 12 8 20 10 14 2 28 3 36 8 5 3 6 9 6 14"/>
    <path d="M58 19c10-2 24-2 36 1l10 16H66z"/>
    <circle cx="66" cy="60" r="12"/><circle cx="164" cy="60" r="12"/>
    <circle cx="66" cy="60" r="4"/><circle cx="164" cy="60" r="4"/>
  </svg>`;

  const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>`;

  const vehicleCards = activeVehicles.map((v) => {
    const imgContent = v.imageUrl
      ? `<img src="${v.imageUrl}" alt="${v.name}">`
      : SVG_CAR;

    return `
    <div class="car">
      <div class="photo">
        <span class="badge">${v.trim || ''}</span>
        <span class="year"><span class="num">${v.year || ''}</span></span>
        ${imgContent}
      </div>
      <div class="car-body">
        <div class="car-name">${v.name}</div>
        <div class="car-sub">${v.subtitle || ''}</div>
        <div class="price">
          <div class="lbl">תשלום חודשי</div>
          <div class="big"><span class="num">&#8362;${fmt(v.monthlyPrice)}</span></div>
          <div class="vat">לפני מע&quot;מ</div>
          <div class="incl">כולל מע&quot;מ 18% &middot; <b><span class="num">&#8362;${fmt(Math.round(v.monthlyPrice * VAT))}</span></b></div>
        </div>
        <div class="specs">
          <div class="spec"><span class="sk">מחירון יבואן</span><span class="sv"><span class="num">&#8362;${fmt(v.listPrice)}</span></span></div>
          <div class="spec"><span class="sk">מקדמה (כולל מע&quot;מ)</span><span class="sv"><span class="num">&#8362;${fmt(v.downPayment)}</span></span></div>
        </div>
        <div class="pill-row">
          <div class="pill"><span class="num">${v.months || 36}</span> חודשים</div>
          <div class="pill"><span class="num">${fmt(v.annualKm)}</span> ק&quot;מ/שנה</div>
        </div>
      </div>
    </div>`;
  }).join('');

  const subtitleParts = ['סמארט קאר 2008 בע&quot;מ'];
  if (data.companyName) subtitleParts.push(data.companyName);
  const subtitleStr = subtitleParts.join(' &middot; ');
  const companyIdStr = data.companyId ? ` ח.פ <span class="num">${data.companyId}</span>` : '';

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700&family=Heebo:wght@400;500;700;800;900&display=swap" rel="stylesheet">
<style>
  :root{
    --ink:#122b23;--ink-2:#0b1d17;--ink-3:#1c3a31;
    --amber:#c87b42;--amber-soft:#dea370;
    --cream:#f5f2ec;--card:#ffffff;
    --line:#e6dfd2;--line-2:#2c4a40;
    --muted:#778880;--text:#1d2b25;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#fff;}
  body{font-family:"Assistant",system-ui,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased;}
  .num{direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums;}
  .doc{width:794px;min-height:1123px;background:var(--card);overflow:hidden;display:flex;flex-direction:column;}
  .top{background:linear-gradient(135deg,var(--ink) 0%,var(--ink-2) 100%);color:#fff;position:relative;padding:24px 40px 20px;overflow:hidden;}
  .top::after{content:"";position:absolute;left:-90px;top:-130px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle at center,rgba(200,123,66,.16),transparent 62%);}
  .brand{display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1;}
  .logo{height:50px;width:auto;display:block;filter:brightness(0) invert(1);}
  .brand-tag{font-size:11px;color:#9fb2aa;letter-spacing:5px;font-weight:500;}
  .meta{position:relative;z-index:1;margin-top:18px;display:flex;border:1px solid var(--line-2);border-radius:9px;overflow:hidden;}
  .meta>div{flex:1;padding:9px 15px;}
  .meta>div+div{border-right:1px solid var(--line-2);}
  .meta .k{font-size:10px;color:#9fb2aa;font-weight:500;margin-bottom:2px;}
  .meta .v{font-size:13px;color:#fff;font-weight:600;}
  .title{text-align:center;padding:18px 40px 2px;}
  .eyebrow{font-size:11px;letter-spacing:5px;color:var(--amber);font-weight:600;}
  .title h1{font-family:"Heebo";font-weight:800;font-size:18px;color:var(--ink);margin-top:5px;}
  .title .sub{font-size:12px;color:var(--muted);margin-top:3px;}
  .title .rule{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:9px;}
  .title .rule .l{width:42px;height:1px;background:var(--line);}
  .title .rule .d{width:5px;height:5px;background:var(--amber);transform:rotate(45deg);}
  .cars{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:14px 40px 6px;}
  .cars.single{grid-template-columns:minmax(0,380px);justify-content:center;}
  .car{border:1px solid var(--line);border-radius:13px;overflow:hidden;display:flex;flex-direction:column;background:var(--card);}
  .photo{position:relative;height:118px;background:linear-gradient(180deg,#f3f0ea 0%,#e9e4d8 100%);display:flex;align-items:center;justify-content:center;}
  .photo img{max-width:80%;max-height:96px;object-fit:contain;}
  .photo .ph{width:66%;height:auto;opacity:.5;}
  .badge{position:absolute;top:11px;right:11px;background:rgba(18,43,35,.92);color:#fff;font-size:9px;font-weight:700;letter-spacing:2.5px;padding:4px 10px;border-radius:5px;}
  .year{position:absolute;bottom:9px;left:13px;color:#98a39c;font-weight:700;font-size:13px;}
  .car-body{padding:14px 16px 16px;display:flex;flex-direction:column;flex:1;}
  .car-name{font-family:"Heebo";font-weight:800;font-size:17px;color:var(--ink);text-align:right;}
  .car-sub{font-size:12px;color:var(--muted);text-align:right;margin-top:1px;}
  .price{margin-top:12px;border-radius:10px;background:linear-gradient(135deg,var(--ink) 0%,var(--ink-2) 100%);color:#fff;text-align:center;padding:13px 12px 11px;}
  .price .lbl{font-size:10px;letter-spacing:3px;color:#9fb2aa;font-weight:500;}
  .price .big{font-family:"Heebo";font-weight:900;font-size:29px;color:var(--amber-soft);line-height:1;margin:5px 0 2px;}
  .price .vat{font-size:10px;color:#8ea49b;}
  .price .incl{margin-top:8px;padding-top:7px;border-top:1px solid var(--line-2);font-size:11.5px;color:#cfd9d4;font-weight:600;}
  .price .incl b{color:#fff;}
  .specs{margin-top:12px;}
  .spec{display:flex;justify-content:space-between;align-items:center;padding:7px 2px;border-bottom:1px solid var(--line);font-size:12.5px;}
  .spec:last-of-type{border-bottom:none;}
  .spec .sk{color:var(--muted);}
  .spec .sv{font-weight:700;color:var(--ink);}
  .pill-row{display:flex;gap:6px;margin-top:9px;}
  .pill{flex:1;text-align:center;border:1px solid var(--line);border-radius:7px;padding:6px 4px;font-size:11.5px;font-weight:600;color:var(--ink);}
  .section{padding:4px 40px;}
  .section-head{display:flex;align-items:center;gap:9px;margin:14px 0 11px;}
  .section-head .dot{width:6px;height:6px;border-radius:50%;background:var(--amber);}
  .section-head h2{font-family:"Heebo";font-weight:700;font-size:14px;color:var(--ink);}
  .section-head .ln{flex:1;height:1px;background:var(--line);}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:8px 26px;}
  .item{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;line-height:1.4;color:var(--text);}
  .item .chk{flex:none;width:17px;height:17px;border-radius:50%;background:rgba(200,123,66,.12);color:var(--amber);display:flex;align-items:center;justify-content:center;margin-top:1px;font-weight:700;}
  .item .chk svg{width:10px;height:10px;}
  .item.dash .chk{background:rgba(18,43,35,.07);color:var(--ink);font-size:14px;line-height:0;}
  .note{margin:14px 40px 0;border-radius:10px;background:#f0ede5;border:1px solid var(--line);border-right:4px solid var(--amber);padding:12px 15px;font-size:12px;color:#56635d;line-height:1.5;}
  .sign{padding:14px 40px 4px;}
  .sign .by{font-size:12.5px;color:var(--muted);}
  .sign .co{font-family:"Heebo";font-weight:800;font-size:15px;color:var(--ink);margin-top:2px;}
  .foot{background:linear-gradient(135deg,var(--ink-2) 0%,var(--ink) 100%);color:#fff;padding:18px 40px 15px;margin-top:auto;}
  .branches{display:grid;grid-template-columns:1fr 1fr 1fr;text-align:center;}
  .branches>div{padding:0 14px;}
  .branches>div+div{border-right:1px solid var(--line-2);}
  .branches h3{font-family:"Heebo";font-weight:700;font-size:13px;color:#fff;margin-bottom:4px;}
  .branches p{font-size:11.5px;color:#9fb2aa;line-height:1.5;}
  .branches .tel{color:var(--amber-soft);font-weight:700;direction:ltr;unicode-bidi:isolate;}
  .foot-base{margin-top:13px;padding-top:11px;border-top:1px solid var(--line-2);text-align:center;font-size:11.5px;color:#8ea49b;direction:ltr;}
  @page{size:A4;margin:0;}
</style>
</head>
<body>
<div class="doc">
  <header class="top">
    <div class="brand">
      <img class="logo" src="${logoUrl}" alt="SMART CAR">
      <div class="brand-tag">השכרת רכב עד בית הלקוח</div>
    </div>
    <div class="meta">
      <div><div class="k">לכבוד</div><div class="v">${data.customerName || '—'}</div></div>
      <div><div class="k">תאריך</div><div class="v"><span class="num">${data.date || '—'}</span></div></div>
      <div><div class="k">בתוקף עד</div><div class="v"><span class="num">${validUntil}</span></div></div>
    </div>
  </header>

  <div class="title">
    <div class="eyebrow">הצעת מחיר</div>
    <h1>מס׳ <span class="num">${data.quoteNumber}</span></h1>
    <div class="sub">${subtitleStr}${companyIdStr}</div>
    <div class="rule"><span class="l"></span><span class="d"></span><span class="l"></span></div>
  </div>

  <div class="${carsClass}">
    ${vehicleCards}
  </div>

  <div class="section">
    <div class="section-head"><span class="dot"></span><h2>ההצעה כוללת</h2><span class="ln"></span></div>
    <div class="grid-2">
      <div class="item"><span class="chk">${CHECK_SVG}</span><span>זמינות מיידית של הרכב – במלאי</span></div>
      <div class="item"><span class="chk">${CHECK_SVG}</span><span>החלפת 4 צמיגים בגין בלאי, מצבר וסט מגבים</span></div>
      <div class="item"><span class="chk">${CHECK_SVG}</span><span>טיפולים שוטפים לפי הוראות יצרן במוסכים מורשים</span></div>
      <div class="item"><span class="chk">${CHECK_SVG}</span><span>אגרת רישוי שנתית</span></div>
      <div class="item"><span class="chk">${CHECK_SVG}</span><span>רכב חליפי במקרה של תקלה או תאונה</span></div>
      <div class="item"><span class="chk">${CHECK_SVG}</span><span>אופציית רכישה: 16% הנחה ממחירון יבואן</span></div>
      <div class="item"><span class="chk">${CHECK_SVG}</span><span>כיסוי ביטוחי מורחב לפי תנאי ההסכם</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-head"><span class="dot"></span><h2>תנאים נוספים</h2><span class="ln"></span></div>
    <div class="grid-2">
      <div class="item dash"><span class="chk">&middot;</span><span>המחיר החודשי צמוד למדד המחירים לצרכן</span></div>
      <div class="item dash"><span class="chk">&middot;</span><span>תשלום חודשי בהוראת קבע</span></div>
      <div class="item dash"><span class="chk">&middot;</span><span>השתתפות עצמית <span class="num">2,500 &#8362;</span> + מע&quot;מ</span></div>
      <div class="item dash"><span class="chk">&middot;</span><span>חריגת ק&quot;מ: <span class="num">0.5 &#8362;</span> בתוספת מע&quot;מ לק&quot;מ</span></div>
    </div>
  </div>

  <div class="note">
    הצעה זו אינה מהווה חוזה מחייב. ההסכם הסופי ייחתם בכתב על ידי שני הצדדים בלבד. ההצעה בתוקף עד <b><span class="num">${validUntil}</span></b>.
  </div>

  <div class="sign">
    <div class="by">בברכה,</div>
    <div class="co">סמארט קאר 2008 בע&quot;מ</div>
  </div>

  <footer class="foot">
    <div class="branches">
      <div><h3>הרצליה</h3><p>רח׳ רמת ים 122<br>מלון דן אכדיה<br><span class="tel">09-9509757</span></p></div>
      <div><h3>תל אביב</h3><p>רח׳ הירקון 112<br>פינת רח׳ מאפו<br><span class="tel">03-5233073</span></p></div>
      <div><h3>ירושלים</h3><p>רח׳ המלך דוד 8<br>&nbsp;<br><span class="tel">02-6221150</span></p></div>
    </div>
    <div class="foot-base">www.smartcar.co.il &middot; office@smartcar.co.il</div>
  </footer>
</div>
</body>
</html>`;
}

export function generateQuoteNumber(): string {
  const ts = Date.now().toString();
  return ts.slice(-5);
}

export function todayIL(): string {
  return new Date().toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function emptyVehicle(): QuoteVehicle {
  return {
    name: '',
    subtitle: '',
    trim: 'STANDARD',
    year: new Date().getFullYear().toString(),
    listPrice: 0,
    downPayment: 0,
    monthlyPrice: 0,
    months: 36,
    annualKm: 25000,
    imageUrl: '',
  };
}
