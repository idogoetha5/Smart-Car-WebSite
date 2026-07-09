import {
  heebo400, heebo700, heebo800, heebo900,
  assistant400, assistant600, logo_png,
} from './quote-assets';

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
  // todayIL() formats as DD.MM.YYYY (dots); accept slashes too.
  const [d, m, y] = dateStr.split(/[./]/).map(Number);
  if (!d || !m || !y) return '—';
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return dt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const FONT_FACES = `
@font-face{font-family:'Heebo';font-weight:400;font-style:normal;src:url(data:font/ttf;base64,${heebo400}) format('truetype');}
@font-face{font-family:'Heebo';font-weight:700;font-style:normal;src:url(data:font/ttf;base64,${heebo700}) format('truetype');}
@font-face{font-family:'Heebo';font-weight:800;font-style:normal;src:url(data:font/ttf;base64,${heebo800}) format('truetype');}
@font-face{font-family:'Heebo';font-weight:900;font-style:normal;src:url(data:font/ttf;base64,${heebo900}) format('truetype');}
@font-face{font-family:'Assistant';font-weight:400;font-style:normal;src:url(data:font/ttf;base64,${assistant400}) format('truetype');}
@font-face{font-family:'Assistant';font-weight:600;font-style:normal;src:url(data:font/ttf;base64,${assistant600}) format('truetype');}
`;

const QUOTE_CSS = `
  :root{
    --ink:#0f2620;--ink-2:#081712;--panel:#12352c;
    --amber:#c9823f;--amber-soft:#e2a86e;
    --card:#ffffff;--paper:#faf8f3;
    --line:#e7e0d2;--line-d:#274a3e;
    --muted:#7a8a82;--text:#20302a;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  body{font-family:'Assistant',system-ui,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased;}
  .num{direction:ltr;unicode-bidi:isolate;font-variant-numeric:tabular-nums;}
  .doc{width:794px;height:1123px;overflow:hidden;background:var(--paper);display:flex;flex-direction:column;}
  .doc>*{flex:0 0 auto;}

  /* ---- header ---- */
  .top{background:linear-gradient(140deg,var(--panel) 0%,var(--ink-2) 100%);color:#fff;position:relative;padding:16px 44px 14px;overflow:hidden;}
  .top::after{content:"";position:absolute;inset-inline-start:-120px;top:-150px;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(201,130,63,.22),transparent 60%);}
  .brand{display:flex;align-items:center;justify-content:space-between;position:relative;z-index:1;}
  .logo{height:46px;width:auto;display:block;filter:brightness(0) invert(1);}
  .tag{font-size:10px;color:#a8bcb2;letter-spacing:5px;font-weight:600;}
  .meta{position:relative;z-index:1;margin-top:13px;display:flex;border:1px solid var(--line-d);border-radius:11px;overflow:hidden;background:rgba(255,255,255,.02);}
  .meta>div{flex:1;padding:8px 16px;}
  .meta>div+div{border-right:1px solid var(--line-d);}
  .meta .k{font-size:9.5px;color:#93a89e;font-weight:600;letter-spacing:1px;margin-bottom:3px;}
  .meta .v{font-size:14px;color:#fff;font-weight:600;font-family:'Heebo';}

  /* ---- title ---- */
  .title{text-align:center;padding:11px 44px 3px;}
  .eyebrow{font-size:10.5px;letter-spacing:6px;color:var(--amber);font-weight:700;}
  .title h1{font-family:'Heebo';font-weight:900;font-size:21px;color:var(--ink);margin-top:6px;letter-spacing:.5px;}
  .title .sub{font-size:11.5px;color:var(--muted);margin-top:4px;}
  .rule{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:9px;}
  .rule .l{width:48px;height:1px;background:var(--line);}
  .rule .d{width:5px;height:5px;background:var(--amber);transform:rotate(45deg);}

  /* ---- cars ---- */
  .cars{display:grid;gap:18px;padding:9px 44px 4px;}
  .cars.multi{grid-template-columns:1fr 1fr;}
  .cars.single{grid-template-columns:minmax(0,400px);justify-content:center;}
  .car{border:1px solid var(--line);border-radius:16px;overflow:hidden;background:var(--card);box-shadow:0 6px 20px rgba(15,38,32,.05);}
  .photo{position:relative;height:106px;background:linear-gradient(180deg,#f4f1ea 0%,#e8e2d5 100%);display:flex;align-items:center;justify-content:center;}
  .photo img{max-width:80%;max-height:96px;object-fit:contain;filter:drop-shadow(0 8px 12px rgba(0,0,0,.14));}
  .photo .ph{width:62%;height:auto;opacity:.55;}
  .badge{position:absolute;top:12px;right:12px;background:rgba(15,38,32,.94);color:#fff;font-size:8.5px;font-weight:700;letter-spacing:2.5px;padding:4px 11px;border-radius:6px;font-family:'Heebo';}
  .year{position:absolute;bottom:10px;left:14px;color:#8fa197;font-weight:800;font-size:13px;font-family:'Heebo';}
  .cbody{padding:13px 17px 14px;}
  .cname{font-family:'Heebo';font-weight:800;font-size:18px;color:var(--ink);}
  .csub{font-size:11.5px;color:var(--muted);margin-top:2px;}
  .price{margin-top:11px;border-radius:12px;background:linear-gradient(140deg,var(--panel) 0%,var(--ink-2) 100%);color:#fff;text-align:center;padding:12px 12px 10px;position:relative;overflow:hidden;}
  .plbl{font-size:9.5px;letter-spacing:3.5px;color:#9db2a8;font-weight:600;}
  .pbig{font-family:'Heebo';font-weight:900;font-size:31px;color:var(--amber-soft);line-height:1;margin:6px 0 3px;display:flex;align-items:baseline;justify-content:center;gap:8px;}
  .pvat{font-family:'Assistant';font-size:10px;font-weight:600;color:#8ea49b;letter-spacing:0;}
  .pincl{margin-top:9px;padding-top:8px;border-top:1px solid var(--line-d);font-size:11.5px;color:#d3ddd8;font-weight:600;}
  .pincl b{color:#fff;}
  .specs{margin-top:11px;}
  .spec{display:flex;justify-content:space-between;align-items:center;padding:6px 2px;border-bottom:1px solid var(--line);font-size:12.5px;color:var(--muted);}
  .spec:last-child{border-bottom:none;}
  .spec em{font-style:normal;font-size:10.5px;opacity:.75;}
  .spec .sv{font-weight:700;color:var(--ink);font-family:'Heebo';}
  .pills{display:flex;gap:8px;margin-top:9px;}
  .pill{flex:1;text-align:center;border:1px solid var(--line);background:var(--paper);border-radius:9px;padding:7px 4px;font-size:11.5px;font-weight:600;color:var(--ink);}

  /* ---- sections ---- */
  .sec{padding:4px 44px;}
  .shead{display:flex;align-items:center;gap:10px;margin:8px 0 6px;}
  .shead .dot{width:6px;height:6px;border-radius:50%;background:var(--amber);}
  .shead h2{font-family:'Heebo';font-weight:800;font-size:14px;color:var(--ink);}
  .shead .ln{flex:1;height:1px;background:var(--line);}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:6px 30px;}
  .item{display:flex;align-items:flex-start;gap:9px;font-size:12px;line-height:1.3;color:var(--text);}
  .item .c{flex:none;width:18px;height:18px;border-radius:50%;background:rgba(201,130,63,.13);color:var(--amber);display:flex;align-items:center;justify-content:center;margin-top:1px;}
  .item .c svg{width:11px;height:11px;}
  .item.d .c{background:rgba(15,38,32,.07);color:var(--ink);font-size:15px;line-height:0;font-weight:700;}

  .note{margin:9px 44px 0;border-radius:11px;background:#f1ede4;border:1px solid var(--line);border-right:4px solid var(--amber);padding:10px 16px;font-size:11.5px;color:#5a675f;line-height:1.55;}

  .sign{padding:7px 44px 4px;}
  .sign .by{font-size:12px;color:var(--muted);}
  .sign .co{font-family:'Heebo';font-weight:800;font-size:15px;color:var(--ink);margin-top:2px;}

  .foot{background:linear-gradient(140deg,var(--ink-2) 0%,var(--panel) 100%);color:#fff;padding:13px 44px 10px;margin-top:auto;}
  .branches{display:grid;grid-template-columns:1fr 1fr 1fr;text-align:center;}
  .branches>div{padding:0 16px;}
  .branches>div+div{border-right:1px solid var(--line-d);}
  .branches h3{font-family:'Heebo';font-weight:700;font-size:12.5px;color:#fff;margin-bottom:5px;}
  .branches p{font-size:11px;color:#9db2a8;line-height:1.55;}
  .branches .tel{color:var(--amber-soft);font-weight:700;direction:ltr;unicode-bidi:isolate;display:inline-block;margin-top:2px;}
  .fbase{margin-top:12px;padding-top:10px;border-top:1px solid var(--line-d);text-align:center;font-size:11px;color:#8ea49b;direction:ltr;letter-spacing:.3px;}
  @page{size:794px 1123px;margin:0;}
`;

export function quoteHeadHTML(): string {
  return `<style>${FONT_FACES}${QUOTE_CSS}</style>`;
}

export function generateQuoteHTML(data: QuoteData): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8">${quoteHeadHTML()}</head>
<body>${quoteBodyHTML(data)}</body>
</html>`;
}

export function quoteBodyHTML(data: QuoteData): string {
  const logoUrl = `data:image/png;base64,${logo_png}`;
  const validUntil = data.validUntil ?? (data.date ? addDays(data.date, 30) : '—');
  const activeVehicles = data.vehicles.filter((v) => v.name);
  const isSingle = activeVehicles.length <= 1;

  const SVG_CAR = `<svg class="ph" viewBox="0 0 220 86" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#8ea79c" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 58h192"/>
    <path d="M28 58c-3-15 3-25 16-29 8-2 14-9 24-11 14-3 30-2 44 3 7 3 12 8 20 10 14 2 28 3 36 8 5 3 6 9 6 14"/>
    <path d="M58 19c10-2 24-2 36 1l10 16H66z"/>
    <circle cx="66" cy="60" r="12"/><circle cx="164" cy="60" r="12"/>
    <circle cx="66" cy="60" r="4"/><circle cx="164" cy="60" r="4"/>
  </svg>`;

  const CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>`;

  const vehicleCards = activeVehicles.map((v) => {
    const img = v.imageUrl ? `<img src="${v.imageUrl}" alt="${v.name}">` : SVG_CAR;
    const inclVat = Math.round(v.monthlyPrice * VAT);
    return `
    <div class="car">
      <div class="photo">
        ${v.trim ? `<span class="badge">${v.trim}</span>` : ''}
        ${v.year ? `<span class="year"><span class="num">${v.year}</span></span>` : ''}
        ${img}
      </div>
      <div class="cbody">
        <div class="cname">${v.name}</div>
        ${v.subtitle ? `<div class="csub">${v.subtitle}</div>` : '<div class="csub">&nbsp;</div>'}
        <div class="price">
          <div class="plbl">תשלום חודשי</div>
          <div class="pbig"><span class="num">&#8362;${fmt(v.monthlyPrice)}</span><span class="pvat">לפני מע&quot;מ</span></div>
          <div class="pincl">כולל מע&quot;מ 18% &middot; <b><span class="num">&#8362;${fmt(inclVat)}</span></b></div>
        </div>
        <div class="specs">
          <div class="spec"><span>מחירון יבואן</span><span class="sv"><span class="num">&#8362;${fmt(v.listPrice)}</span></span></div>
          <div class="spec"><span>מקדמה <em>(כולל מע&quot;מ)</em></span><span class="sv"><span class="num">&#8362;${fmt(v.downPayment)}</span></span></div>
        </div>
        <div class="pills">
          <div class="pill"><span class="num">${v.months || 36}</span> חודשים</div>
          <div class="pill"><span class="num">${fmt(v.annualKm)}</span> ק&quot;מ/שנה</div>
        </div>
      </div>
    </div>`;
  }).join('');

  const subParts = ['סמארט קאר 2008 בע&quot;מ'];
  if (data.companyName) subParts.push(data.companyName);
  const subStr = subParts.join(' &middot; ');
  const companyIdStr = data.companyId ? ` &middot; ח.פ <span class="num">${data.companyId}</span>` : '';

  const included = [
    'זמינות מיידית של הרכב — במלאי',
    'החלפת 4 צמיגים בגין בלאי, מצבר וסט מגבים',
    'טיפולים שוטפים לפי הוראות יצרן במוסכים מורשים',
    'אגרת רישוי שנתית',
    'רכב חליפי במקרה של תקלה או תאונה',
    'אופציית רכישה: 16% הנחה ממחירון יבואן',
    'כיסוי ביטוחי מורחב לפי תנאי ההסכם',
  ];
  const terms = [
    'המחיר החודשי צמוד למדד המחירים לצרכן',
    'תשלום חודשי בהוראת קבע',
    'השתתפות עצמית <span class="num">2,500 &#8362;</span> + מע&quot;מ',
    'חריגת ק&quot;מ: <span class="num">0.5 &#8362;</span> בתוספת מע&quot;מ לק&quot;מ',
  ];

  return `<div class="doc">
  <header class="top">
    <div class="brand">
      <img class="logo" src="${logoUrl}" alt="SMART CAR">
      <div class="tag">השכרת רכב עד בית הלקוח</div>
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
    <div class="sub">${subStr}${companyIdStr}</div>
    <div class="rule"><span class="l"></span><span class="d"></span><span class="l"></span></div>
  </div>

  <div class="cars ${isSingle ? 'single' : 'multi'}">
    ${vehicleCards}
  </div>

  <div class="sec">
    <div class="shead"><span class="dot"></span><h2>ההצעה כוללת</h2><span class="ln"></span></div>
    <div class="g2">
      ${included.map((t) => `<div class="item"><span class="c">${CHECK}</span><span>${t}</span></div>`).join('')}
    </div>
  </div>

  <div class="sec">
    <div class="shead"><span class="dot"></span><h2>תנאים נוספים</h2><span class="ln"></span></div>
    <div class="g2">
      ${terms.map((t) => `<div class="item d"><span class="c">&middot;</span><span>${t}</span></div>`).join('')}
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
    <div class="fbase">www.smartcar.co.il &middot; office@smartcar.co.il</div>
  </footer>
</div>`;
}

export function generateQuoteNumber(): string {
  return Date.now().toString().slice(-5);
}

export function todayIL(): string {
  return new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function emptyVehicle(): QuoteVehicle {
  return {
    name: '', subtitle: '', trim: 'STANDARD',
    year: new Date().getFullYear().toString(),
    listPrice: 0, downPayment: 0, monthlyPrice: 0,
    months: 36, annualKm: 25000, imageUrl: '',
  };
}
