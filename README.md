# SmartCar — אתר השכרת רכב

אתר השכרת רכב דו-לשוני (עברית / אנגלית) עם שירות עד בית הלקוח, ניהול הזמנות, ליסינג, ורכבים למכירה.

---

## תיאור הפרויקט

SmartCar הוא אתר השכרת רכב ישראלי המציע:
- השכרת רכב עם משלוח עד הבית
- ליסינג פרטי ועסקי
- רכבים למכירה
- פורטל ניהול מלא לאדמין
- תמיכה מלאה בעברית (RTL) ובאנגלית

---

## טכנולוגיות

| שכבה | טכנולוגיה |
|------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) + React 19, App Router |
| Styling | Tailwind CSS v4, Framer Motion |
| Database | [Supabase](https://supabase.com/) (PostgreSQL) |
| Auth | Supabase Auth OTP (email) + HMAC-SHA256 admin cookie |
| Email | [EmailJS](https://www.emailjs.com/) (client-side + REST API) |
| Rate Limiting | [Upstash Redis](https://upstash.com/) |
| Anti-bot | [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) |
| i18n | [next-intl v4](https://next-intl-docs.vercel.app/) |
| Deployment | [Vercel](https://vercel.com/) |
| Monitoring | Sentry, Vercel Analytics |
| UI Components | Radix UI, Lucide React |
| Forms | React Hook Form + Zod |
| Password Hashing | bcryptjs |

---

## עמודים ופיצ'רים עיקריים

### עמודים ציבוריים

| נתיב | תיאור |
|------|--------|
| `/[locale]` | דף בית עם hero, רכבים מובחרים, ביקורות, FAQ |
| `/[locale]/rental` | השכרת רכב — בחירת רכב עם פילטרים |
| `/[locale]/rental/[id]` | עמוד רכב + טופס הזמנה עם בדיקת זמינות בזמן אמת |
| `/[locale]/catalog` | צי הרכבים המלא עם חיפוש וסינון מתקדם |
| `/[locale]/leasing` | ליסינג פרטי ועסקי + טופס פנייה |
| `/[locale]/cars-for-sale` | רכבים למכירה |
| `/[locale]/contact` | טופס יצירת קשר |
| `/[locale]/branches` | סניפים ומפה |
| `/[locale]/my-bookings` | פורטל לקוח — אימות OTP במייל, צפייה וביטול הזמנות |
| `/[locale]/about` | אודות החברה |

### פאנל ניהול (`/[locale]/admin`)

- **הזמנות** — אישור / דחייה + שליחת מייל אוטומטי ללקוח (EmailJS `template_d6xkjjo`)
- **רכבים** — הוספה, עריכה, מחיקה, העלאת תמונות
- **ביקורות** — אישור / דחייה
- **בקשות ליסינג** — ניהול פניות
- **רכבים למכירה** — ניהול מלאי
- **דשבורד** — סטטיסטיקות, גרף הזמנות שבועי, הכנסה חודשית

### פיצ'רים טכניים

- בדיקת זמינות רכב בזמן אמת (מניעת חפיפות)
- אימות לקוחות ב-OTP (קוד 8 ספרות למייל) — ללא סיסמה
- SMTP מותאם (Gmail) עבור Supabase Auth — ללא מגבלת 2 מיילים לשעה
- Rate limiting על כל טפסי יצירת הקשר (Upstash)
- Honeypot anti-spam על טפסי פנייה
- HSTS + Security Headers (X-Frame-Options, nosniff, Referrer-Policy)
- Row Level Security מוכן ב-Supabase
- Cookie consent עם gating של Google Analytics 4
- `sitemap.xml` דינמי + `robots.txt`
- Canonical URLs ו-hreflang לכל דף
- Preconnect ל-Supabase

---

## משתני סביבה

צור קובץ `.env.local` בשורש הפרויקט:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Admin Auth
ADMIN_COOKIE_SECRET=your_random_secret_min_32_chars
ADMIN_PASSWORD_HASH=your_bcrypt_hash   # bcrypt hash של סיסמת האדמין
# ADMIN_PASSWORD=plaintext_fallback    # fallback לפיתוח מקומי בלבד

# EmailJS
NEXT_PUBLIC_EMAILJS_SERVICE_ID=service_xxxxxxx
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=template_xxxxxxx   # מייל "הזמנה התקבלה"
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your_public_key
EMAILJS_PRIVATE_KEY=your_private_key               # לשליחה server-side (צור קשר)

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=https://your-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token

# Cloudflare Turnstile (anti-bot)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_site_key
TURNSTILE_SECRET_KEY=your_secret_key

# Google Analytics (אופציונלי)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Sentry (אופציונלי)
SENTRY_DSN=https://your-dsn.sentry.io
```

### יצירת bcrypt hash לסיסמת אדמין

```bash
node -e "const b=require('bcryptjs'); b.hash('YOUR_PASSWORD',12).then(console.log)"
```

---

## הרצה מקומית

```bash
# 1. שכפל את הריפו
git clone https://github.com/idogoetha5/Smart-Car-WebSite.git
cd Smart-Car-WebSite

# 2. התקן תלויות
npm install

# 3. הגדר משתני סביבה
# צור .env.local עם הערכים שלך (ראה סעיף למעלה)

# 4. הרץ בסביבת פיתוח
npm run dev
# האתר יהיה זמין ב-http://localhost:3000
# העמוד הראשי מפנה ל-/he או /en

# 5. בנה לפרודקשן
npm run build
npm run start
```

---

## מבנה ספריות עיקרי

```
src/
├── app/
│   ├── [locale]/          # כל העמודים הציבוריים (he/en)
│   │   ├── admin/         # פאנל ניהול (מוגן ב-cookie)
│   │   └── ...
│   └── api/               # API Routes
├── components/
│   ├── admin/             # קומפוננטות אדמין
│   ├── booking/           # טופס הזמנה
│   ├── catalog/           # רשימת רכבים וסינון
│   ├── home/              # Hero, Reviews, FAQ
│   ├── layout/            # Navbar, Footer
│   └── ui/                # קומפוננטות כלליות
├── lib/
│   ├── db/                # פונקציות Supabase
│   ├── admin-auth.ts      # HMAC token signing
│   ├── emailjs.ts         # שליחת מיילים
│   └── ratelimit.ts       # Upstash rate limiting
├── messages/
│   ├── he.json            # תרגומים עברית
│   └── en.json            # תרגומים אנגלית
└── types/                 # TypeScript types
```

---

## פריסה ל-Vercel

```bash
npm i -g vercel
vercel --prod
```

הגדר את כל משתני הסביבה ב-Vercel Dashboard → Project → Settings → Environment Variables.

---

## RLS (Row Level Security)

כל הגישה ל-DB מתבצעת דרך `service_role` (bypasses RLS). להפעלת RLS הרץ ב-Supabase SQL Editor:

```sql
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leasing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars_for_sale ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
```

---

## רישיון

© 2026 SmartCar. כל הזכויות שמורות.
