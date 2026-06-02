-- =============================================================
--  SmartCar – Complete Supabase Database Setup
--  Run once in: Supabase Dashboard → SQL Editor → New Query
--
--  ⚠️  This script is idempotent: it drops and recreates all
--      SmartCar objects. Safe on an empty/fresh database.
--      Running it again will ERASE existing data.
-- =============================================================


-- =============================================================
-- 0. EXTENSIONS
-- =============================================================

-- pgcrypto gives us gen_random_uuid() on older Supabase instances
-- (it's already enabled by default, but we ensure it here)
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =============================================================
-- 1. CLEAN SLATE  (drop in reverse dependency order)
-- =============================================================

DROP TABLE IF EXISTS seo_redirects      CASCADE;
DROP TABLE IF EXISTS leasing_requests   CASCADE;
DROP TABLE IF EXISTS bookings           CASCADE;
DROP TABLE IF EXISTS vehicles           CASCADE;

DROP TYPE IF EXISTS leasing_status      CASCADE;
DROP TYPE IF EXISTS booking_status      CASCADE;
DROP TYPE IF EXISTS fuel_type           CASCADE;
DROP TYPE IF EXISTS transmission        CASCADE;
DROP TYPE IF EXISTS vehicle_category    CASCADE;


-- =============================================================
-- 2. ENUMS
-- =============================================================

CREATE TYPE vehicle_category AS ENUM (
  'ECONOMY',
  'COMPACT',
  'SEDAN',
  'SUV',
  'LUXURY',
  'VAN',
  'CONVERTIBLE',
  'ELECTRIC'
);

CREATE TYPE transmission AS ENUM (
  'AUTOMATIC',
  'MANUAL'
);

CREATE TYPE fuel_type AS ENUM (
  'GASOLINE',
  'DIESEL',
  'ELECTRIC',
  'HYBRID'
);

CREATE TYPE booking_status AS ENUM (
  'PENDING',
  'CONFIRMED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'CANCELLED_BY_CUSTOMER'
);

CREATE TYPE leasing_status AS ENUM (
  'PENDING',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED'
);


-- =============================================================
-- 3. HELPER: auto-update updated_at on every row change
-- =============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- =============================================================
-- 4. TABLES
-- =============================================================

-- -----------------------------------------------------------
-- 4a. vehicles
-- -----------------------------------------------------------
CREATE TABLE vehicles (
  id               TEXT          PRIMARY KEY DEFAULT 'c' || replace(gen_random_uuid()::TEXT, '-', ''),
  make             TEXT          NOT NULL,
  model            TEXT          NOT NULL,
  year             INTEGER       NOT NULL,
  category         vehicle_category NOT NULL,
  transmission     transmission  NOT NULL,
  fuel_type        fuel_type     NOT NULL,
  seats            INTEGER       NOT NULL,
  doors            INTEGER       NOT NULL,
  price_per_day    DECIMAL(10,2) NOT NULL,
  price_per_month  DECIMAL(10,2) NOT NULL,
  deposit_amount   DECIMAL(10,2) NOT NULL,
  mileage_limit    INTEGER,
  image_urls       TEXT[]        NOT NULL DEFAULT '{}',
  features         TEXT[]        NOT NULL DEFAULT '{}',
  is_available     BOOLEAN       NOT NULL DEFAULT TRUE,
  is_featured      BOOLEAN       NOT NULL DEFAULT FALSE,
  color_he         TEXT,
  color_en         TEXT,
  description_he   TEXT,
  description_en   TEXT,
  license_plate    TEXT          UNIQUE,
  total_units      INTEGER       NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------
-- 4b. bookings
-- -----------------------------------------------------------
CREATE TABLE bookings (
  id                  TEXT          PRIMARY KEY DEFAULT 'c' || replace(gen_random_uuid()::TEXT, '-', ''),
  vehicle_id          TEXT          NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  customer_name       TEXT          NOT NULL,
  customer_email      TEXT          NOT NULL,
  customer_phone      TEXT          NOT NULL,
  customer_id_number  TEXT,
  pickup_date         TIMESTAMPTZ   NOT NULL,
  dropoff_date        TIMESTAMPTZ   NOT NULL,
  pickup_location     TEXT          NOT NULL,
  dropoff_location    TEXT          NOT NULL,
  total_days          INTEGER       NOT NULL,
  price_per_day       DECIMAL(10,2) NOT NULL,
  total_price         DECIMAL(10,2) NOT NULL,
  deposit_paid        BOOLEAN       NOT NULL DEFAULT FALSE,
  status              booking_status NOT NULL DEFAULT 'PENDING',
  notes               TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_vehicle_id ON bookings(vehicle_id);
CREATE INDEX idx_bookings_status     ON bookings(status);
CREATE INDEX idx_bookings_dates      ON bookings(pickup_date, dropoff_date);

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------
-- 4c. leasing_requests
-- -----------------------------------------------------------
CREATE TABLE leasing_requests (
  id                TEXT          PRIMARY KEY DEFAULT 'c' || replace(gen_random_uuid()::TEXT, '-', ''),
  vehicle_id        TEXT          NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  customer_name     TEXT          NOT NULL,
  customer_email    TEXT          NOT NULL,
  customer_phone    TEXT          NOT NULL,
  company_name      TEXT,
  duration_months   INTEGER       NOT NULL,
  down_payment      DECIMAL(10,2) NOT NULL,
  estimated_monthly DECIMAL(10,2) NOT NULL,
  mileage_package   INTEGER       NOT NULL,
  status            leasing_status NOT NULL DEFAULT 'PENDING',
  notes             TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leasing_vehicle_id ON leasing_requests(vehicle_id);
CREATE INDEX idx_leasing_status     ON leasing_requests(status);

CREATE TRIGGER trg_leasing_updated_at
  BEFORE UPDATE ON leasing_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------
-- 4d. seo_redirects
-- -----------------------------------------------------------
CREATE TABLE seo_redirects (
  id         TEXT        PRIMARY KEY DEFAULT 'c' || replace(gen_random_uuid()::TEXT, '-', ''),
  from_path  TEXT        NOT NULL UNIQUE,
  to_path    TEXT        NOT NULL,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =============================================================
-- 5. ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE vehicles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE leasing_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_redirects      ENABLE ROW LEVEL SECURITY;


-- =============================================================
-- 6. POLICIES
-- =============================================================

-- vehicles: anyone can read, only service-role can write
CREATE POLICY "Public can read vehicles"
  ON vehicles FOR SELECT
  USING (TRUE);

CREATE POLICY "Service role manages vehicles"
  ON vehicles FOR ALL
  USING (auth.role() = 'service_role');

-- bookings: anyone can insert (to book), service-role can read/update
CREATE POLICY "Public can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Service role manages bookings"
  ON bookings FOR ALL
  USING (auth.role() = 'service_role');

-- Allow server-side availability check (SELECT only for conflict detection)
CREATE POLICY "Public can read own booking conflicts"
  ON bookings FOR SELECT
  USING (TRUE);

-- leasing_requests: anyone can insert, service-role can read/update
CREATE POLICY "Public can submit leasing requests"
  ON leasing_requests FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Service role manages leasing requests"
  ON leasing_requests FOR ALL
  USING (auth.role() = 'service_role');

-- seo_redirects: service-role only
CREATE POLICY "Service role manages seo_redirects"
  ON seo_redirects FOR ALL
  USING (auth.role() = 'service_role');


-- =============================================================
-- 7. SEED DATA – 10 Vehicles
-- =============================================================

INSERT INTO vehicles (
  make, model, year, category, transmission, fuel_type,
  seats, doors,
  price_per_day, price_per_month, deposit_amount,
  image_urls, features,
  is_available, is_featured,
  color_he, color_en,
  description_he, description_en,
  total_units
) VALUES

-- 1. Toyota Corolla – bestselling sedan (featured)
(
  'Toyota', 'Corolla', 2024,
  'SEDAN', 'AUTOMATIC', 'GASOLINE',
  5, 4,
  180.00, 3200.00, 1500.00,
  '{}',
  ARRAY['Bluetooth', 'גיבוי קאמרה', 'Apple CarPlay', 'מצלמה אחורית'],
  TRUE, TRUE,
  'לבן פנינה', 'Pearl White',
  'טויוטה קורולה 2024 – הרכב האמין והחסכוני ביותר לנסיעות יומיומיות. מתאים למשפחות ולנסיעות עסקיות.',
  'Toyota Corolla 2024 – the most reliable and fuel-efficient car for daily driving. Perfect for families and business trips.',
  5
),

-- 2. Hyundai Tucson Hybrid – popular SUV (featured)
(
  'Hyundai', 'Tucson', 2024,
  'SUV', 'AUTOMATIC', 'HYBRID',
  5, 5,
  280.00, 5200.00, 2000.00,
  '{}',
  ARRAY['גג שמש', 'מושבי עור', 'ניווט', 'מושבים מחוממים', 'חניית חיישנים'],
  TRUE, TRUE,
  'אפור מטאלי', 'Metallic Grey',
  'יונדאי טוסון היברידי 2024 – SUV מרווח וחסכוני בדלק עם מערכת היברידית מתקדמת. אידיאלי לנסיעות ארוכות ולמשפחות.',
  'Hyundai Tucson Hybrid 2024 – spacious and fuel-efficient SUV with advanced hybrid system. Ideal for long trips and families.',
  3
),

-- 3. Tesla Model 3 – electric flagship (featured)
(
  'Tesla', 'Model 3', 2024,
  'ELECTRIC', 'AUTOMATIC', 'ELECTRIC',
  5, 4,
  350.00, 6500.00, 3000.00,
  '{}',
  ARRAY['Autopilot', 'מסך 15 אינץ', 'טעינה מהירה', 'עדכונים אוטומטיים', '0-100 ב-3.3 שניות'],
  TRUE, TRUE,
  'שחור מולטי-שכבות', 'Multi-Coat Black',
  'טסלה מודל 3 2024 – חוויית נהיגה עתידנית עם טווח נסיעה של 600 ק"מ בטעינה. הרכב החשמלי הנמכר ביותר בישראל.',
  'Tesla Model 3 2024 – futuristic driving experience with 600km range per charge. The best-selling electric car in Israel.',
  2
),

-- 4. Kia Picanto – economy city car
(
  'Kia', 'Picanto', 2023,
  'ECONOMY', 'MANUAL', 'GASOLINE',
  5, 5,
  120.00, 2100.00, 800.00,
  '{}',
  ARRAY['מיזוג אוויר', 'USB', 'ABS', 'עזרה בחניה'],
  TRUE, FALSE,
  'אדום להבה', 'Flame Red',
  'קיה פיקנטו 2023 – הרכב החסכוני והאמין ביותר לנסיעות בעיר. קל לחניה, זול לתחזוקה.',
  'Kia Picanto 2023 – the most economical city car. Easy to park, cheap to maintain, perfect for urban driving.',
  8
),

-- 5. BMW 5 Series – executive luxury
(
  'BMW', '530i', 2024,
  'LUXURY', 'AUTOMATIC', 'GASOLINE',
  5, 4,
  550.00, 10000.00, 5000.00,
  '{}',
  ARRAY['מערכת סאונד Harman Kardon', 'מושבי עיסוי', 'צג ראש', 'שמשת פנורמה', 'קרוז קונטרול אדפטיבי', 'עור מלא'],
  TRUE, FALSE,
  'כחול נייבי מטאלי', 'Metallic Navy Blue',
  'BMW סדרה 5 2024 – יוקרה גרמנית עם ביצועים יוצאי דופן. הרכב המנהלים המושלם לנסיעות עסקיות בסגנון.',
  'BMW 5 Series 2024 – German luxury with extraordinary performance. The perfect executive car for stylish business travel.',
  2
),

-- 6. Volkswagen Golf – practical compact
(
  'Volkswagen', 'Golf', 2023,
  'COMPACT', 'AUTOMATIC', 'GASOLINE',
  5, 5,
  200.00, 3600.00, 1500.00,
  '{}',
  ARRAY['קוקפיט דיגיטלי', 'Apple CarPlay', 'חיישני חניה', 'מצלמה אחורית', 'Lane Assist'],
  TRUE, FALSE,
  'לבן פנינה', 'Pearl White',
  'פולקסווגן גולף 2023 – קומפקטי עם כיתה גבוהה. שילוב מושלם של חסכנות, נוחות וביצועים.',
  'Volkswagen Golf 2023 – compact with premium class. The perfect balance of economy, comfort, and performance.',
  4
),

-- 7. Ford Transit – 9-seat van
(
  'Ford', 'Transit', 2023,
  'VAN', 'MANUAL', 'DIESEL',
  9, 5,
  320.00, 5800.00, 2500.00,
  '{}',
  ARRAY['מיזוג אחורי', 'מצלמה אחורית', 'דלתות הזזה', 'Bluetooth', 'ניווט'],
  TRUE, FALSE,
  'כסוף מטאלי', 'Metallic Silver',
  'פורד טרנזיט 9 מושבים 2023 – הפתרון המושלם לנסיעות קבוצתיות, טיולים ואירועים משפחתיים.',
  'Ford Transit 9-seater 2023 – the perfect solution for group travel, family trips, and events.',
  3
),

-- 8. Mazda MX-5 – sports convertible
(
  'Mazda', 'MX-5 Miata', 2024,
  'CONVERTIBLE', 'MANUAL', 'GASOLINE',
  2, 2,
  420.00, 7500.00, 4000.00,
  '{}',
  ARRAY['גג מתקפל', 'מערכת Bose', 'מושבי עור', 'בקרת יציבות', 'אור LED'],
  TRUE, FALSE,
  'אדום נשמה', 'Soul Red Crystal',
  'מאזדה MX-5 2024 – קברירוליט ספורטיבי לחוויית נהיגה בלתי נשכחת. הנאה טהורה על הכביש.',
  'Mazda MX-5 2024 – sporty convertible for an unforgettable driving experience. Pure joy on the road.',
  1
),

-- 9. Toyota RAV4 Hybrid – all-terrain SUV
(
  'Toyota', 'RAV4', 2024,
  'SUV', 'AUTOMATIC', 'HYBRID',
  5, 5,
  300.00, 5500.00, 2200.00,
  '{}',
  ARRAY['הנעה כפולה AWD', 'Toyota Safety Sense', 'Apple CarPlay', 'מושבים מחוממים', 'עוצמה 222 כ"ס'],
  TRUE, FALSE,
  'ירוק יער', 'Woodland Green',
  'טויוטה RAV4 היברידי 2024 – SUV אמין לכל שטח. הנעה כפולה, יעילות דלק מעולה וטכנולוגיה מתקדמת.',
  'Toyota RAV4 Hybrid 2024 – reliable all-terrain SUV. AWD drive, excellent fuel efficiency and advanced technology.',
  3
),

-- 10. Mercedes E-Class – premium (currently unavailable)
(
  'Mercedes-Benz', 'E 220d', 2024,
  'LUXURY', 'AUTOMATIC', 'DIESEL',
  5, 4,
  680.00, 12500.00, 6000.00,
  '{}',
  ARRAY['MBUX עם AI', 'מערכת Burmester', 'מתלה אוויר', 'חבילת נהיגה', 'מושבי וונטילציה', 'ראיית לילה'],
  FALSE, FALSE,
  'שחור אובסידיאן', 'Obsidian Black',
  'מרצדס E 220d 2024 – סדן יוקרתי עם המנוע הדיזל היעיל ביותר. הגדרה מחדש של מושג הנסיעה.',
  'Mercedes-Benz E 220d 2024 – luxury sedan with the most efficient diesel engine. Redefining the concept of travel.',
  1
);


-- =============================================================
-- 8. VERIFY
-- =============================================================

SELECT
  make || ' ' || model || ' ' || year  AS vehicle,
  category,
  price_per_day                         AS "₪/day",
  is_featured,
  is_available
FROM vehicles
ORDER BY price_per_day;
