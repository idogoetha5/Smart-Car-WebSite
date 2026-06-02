-- ============================================================
-- SmartCar – Full Fleet Refresh
-- Source: Excel fleet file, 335 vehicles → 58 unique models
-- Prices are RENTAL RATES only (not purchase values)
-- Run in Supabase SQL Editor
-- ============================================================

BEGIN;

DELETE FROM leasing_requests;
DELETE FROM bookings;
DELETE FROM vehicles;

-- ============================================================
-- ECONOMY  |  ₪220 / day  |  ₪3,500 / month  |  deposit ₪1,000
-- ============================================================
INSERT INTO vehicles (make, model, year, category, transmission, fuel_type, seats, doors,
  price_per_day, price_per_month, deposit_amount, image_urls, features,
  is_available, is_featured, color_he, color_en, description_he, description_en, total_units)
VALUES
  ('KIA', 'Picanto', 2024, 'ECONOMY', 'AUTOMATIC', 'GASOLINE', 5, 5, 220, 3500, 1000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','USB','עזרה בחניה'],
   true, true, 'לבן', 'White',
   'קיה פיקנטו – הרכב הכלכלי המושלם לעיר. קל לחניה, חסכוני בדלק ואמין לנסיעות יומיומיות.',
   'KIA Picanto – the perfect economy city car. Easy to park, fuel-efficient, and reliable for daily use.',
   78),

  ('Toyota', 'Aygo X', 2023, 'ECONOMY', 'MANUAL', 'GASOLINE', 5, 5, 220, 3500, 1000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS'],
   true, false, 'לבן', 'White',
   'טויוטה איגו X – רכב קטן ואורבני עם מראה ספורטיבי וקלות תמרון בעיר.',
   'Toyota Aygo X – a compact urban car with a sporty look and easy city maneuverability.',
   1),

  ('Hyundai', 'i10', 2023, 'ECONOMY', 'AUTOMATIC', 'GASOLINE', 5, 5, 220, 3500, 1000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','USB'],
   true, false, 'אפור', 'Grey',
   'יונדאי i10 – רכב עירוני קומפקטי וחסכוני בדלק, עם ניהול קל ותא נהג נוח.',
   'Hyundai i10 – a compact and fuel-efficient urban car with easy handling and a comfortable cabin.',
   1),

  ('Renault', 'Clio', 2023, 'ECONOMY', 'AUTOMATIC', 'GASOLINE', 5, 5, 220, 3500, 1000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay'],
   true, false, 'לבן', 'White',
   'רנו קליאו – קלאסיקה צרפתית. עיצוב אופנתי עם נסיעה נינוחה ואבזור מודרני.',
   'Renault Clio – a French classic with stylish design, smooth ride, and modern features.',
   3),

  ('Dacia', 'Sandero', 2023, 'ECONOMY', 'MANUAL', 'GASOLINE', 5, 5, 220, 3500, 1000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS'],
   true, false, 'לבן', 'White',
   'דאציה סנדרו – רכב כלכלי ופרקטי עם שטח פנים מרשים יחסית לגודלו.',
   'Dacia Sandero – an economical and practical car with impressive interior space for its size.',
   3),

  ('Mazda', '2', 2024, 'ECONOMY', 'AUTOMATIC', 'GASOLINE', 5, 5, 220, 3500, 1000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית'],
   true, false, 'אדום', 'Red',
   'מאזדה 2 – רכב קטן עם סגנון גדול. עיצוב יפני מרהיב עם ביצועי נהיגה מהנים.',
   'Mazda 2 – a small car with big style. Stunning Japanese design with enjoyable driving dynamics.',
   23),

  ('Mitsubishi', 'Space Star', 2023, 'ECONOMY', 'MANUAL', 'GASOLINE', 5, 5, 220, 3500, 1000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS'],
   true, false, 'כסוף', 'Silver',
   'מיצובישי ספייס סטאר – הצ''בק הקטן האמין. נוח לנסיעה בעיר ובכביש המהיר.',
   'Mitsubishi Space Star – the reliable compact hatchback. Comfortable for city and highway driving.',
   12),

  ('Nissan', 'Micra', 2022, 'ECONOMY', 'AUTOMATIC', 'GASOLINE', 5, 5, 220, 3500, 1000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS'],
   true, false, 'אפור', 'Grey',
   'ניסאן מיקרה – רכב עירוני קטן ופרקטי עם אמינות ניסאן האופיינית.',
   'Nissan Micra – a small, practical urban vehicle with Nissan''s characteristic reliability.',
   1),

  ('Peugeot', '301', 2022, 'ECONOMY', 'MANUAL', 'GASOLINE', 5, 4, 220, 3500, 1000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS'],
   true, false, 'לבן', 'White',
   'פיז''ו 301 – סדאן צרפתי כלכלי ומרווח, מושלם לנסיעות משפחתיות.',
   'Peugeot 301 – an economical and spacious French sedan, perfect for family trips.',
   1);

-- ============================================================
-- COMPACT  |  ₪300 / day  |  ₪5,000 / month  |  deposit ₪1,500
-- ============================================================
INSERT INTO vehicles (make, model, year, category, transmission, fuel_type, seats, doors,
  price_per_day, price_per_month, deposit_amount, image_urls, features,
  is_available, is_featured, color_he, color_en, description_he, description_en, total_units)
VALUES
  ('Toyota', 'Yaris', 2024, 'COMPACT', 'AUTOMATIC', 'GASOLINE', 5, 5, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה'],
   true, true, 'לבן', 'White',
   'טויוטה יאריס 2024 – אמינות יפנית עם ביצועים יעילים. אחד הרכבים הפופולריים ביותר בישראל.',
   'Toyota Yaris 2024 – Japanese reliability with efficient performance. One of Israel''s most popular cars.',
   22),

  ('KIA', 'Rio', 2023, 'COMPACT', 'AUTOMATIC', 'GASOLINE', 5, 5, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית'],
   true, false, 'אפור', 'Grey',
   'קיה ריו – קומפקטי חכם עם טכנולוגיה מתקדמת ועיצוב אורבני מרשים.',
   'KIA Rio – a smart compact with advanced technology and an impressive urban design.',
   10),

  ('KIA', 'Stonic', 2024, 'COMPACT', 'AUTOMATIC', 'GASOLINE', 5, 5, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה'],
   true, false, 'כחול', 'Blue',
   'קיה סטוניק – קרוסאובר קומפקטי עם מראה ספורטיבי ותא נהג מרווח ונוח.',
   'KIA Stonic – a compact crossover with a sporty look and a spacious, comfortable cabin.',
   14),

  ('Nissan', 'Sentra', 2024, 'COMPACT', 'AUTOMATIC', 'GASOLINE', 5, 4, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','ניווט'],
   true, false, 'לבן', 'White',
   'ניסאן סנטרה – סדאן קומפקטי מרווח עם נוחות גבוהה ועיצוב מודרני.',
   'Nissan Sentra – a spacious compact sedan with high comfort and modern design.',
   24),

  ('Hyundai', 'i20', 2023, 'COMPACT', 'AUTOMATIC', 'GASOLINE', 5, 5, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay'],
   true, false, 'לבן', 'White',
   'יונדאי i20 – הצ''בק הקוריאני הנוח עם עיצוב מודרני ואבזור טוב.',
   'Hyundai i20 – the comfortable Korean hatchback with modern design and good equipment.',
   3),

  ('Honda', 'City', 2023, 'COMPACT', 'AUTOMATIC', 'GASOLINE', 5, 4, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית'],
   true, false, 'כסוף', 'Silver',
   'הונדה סיטי – סדאן קומפקטי יפני עם פנים מרשים ומנוע יעיל וחסכוני.',
   'Honda City – a Japanese compact sedan with impressive interior and an efficient, economical engine.',
   6),

  ('Hyundai', 'Bayon', 2023, 'COMPACT', 'AUTOMATIC', 'GASOLINE', 5, 5, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','חיישני חניה'],
   true, false, 'אפור', 'Grey',
   'יונדאי ביון – קרוסאובר קטן וחמוד עם יתרונות של SUV במחיר קומפקטי.',
   'Hyundai Bayon – a small and charming crossover with SUV advantages at a compact price.',
   2),

  ('KIA', 'XCeed', 2023, 'COMPACT', 'AUTOMATIC', 'GASOLINE', 5, 5, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','ניווט'],
   true, false, 'שחור', 'Black',
   'קיה XCeed – קרוסאובר קומפקטי עם עיצוב ספורטיבי ואבזור עשיר ומרשים.',
   'KIA XCeed – a compact crossover with sporty design and rich, impressive equipment.',
   2),

  ('Mazda', '3', 2024, 'COMPACT', 'AUTOMATIC', 'GASOLINE', 5, 5, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','מושבים מחוממים'],
   true, false, 'אדום', 'Red',
   'מאזדה 3 – עיצוב יפני מרהיב עם ביצועי נהיגה ספורטיביים ואבזור ברמה גבוהה.',
   'Mazda 3 – stunning Japanese design with sporty driving performance and premium-level equipment.',
   6),

  ('Chery', 'FX', 2023, 'COMPACT', 'AUTOMATIC', 'GASOLINE', 5, 5, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית'],
   true, false, 'לבן', 'White',
   'צ''רי FX – רכב קומפקטי עם ערך לכסף גבוה ואבזור מלא.',
   'Chery FX – a compact with great value for money and full equipment.',
   5),

  ('KIA', 'Ceed', 2023, 'COMPACT', 'AUTOMATIC', 'GASOLINE', 5, 5, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית'],
   true, false, 'אפור', 'Grey',
   'קיה סיד – קומפקטי אירופאי עם מיקום נהיגה מעולה ועיצוב בוגר.',
   'KIA Ceed – a European compact with an excellent driving position and mature design.',
   1),

  ('Seat', 'Arona', 2023, 'COMPACT', 'AUTOMATIC', 'GASOLINE', 5, 5, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','חיישני חניה'],
   true, false, 'לבן', 'White',
   'סיאט ארונה – קרוסאובר קומפקטי ספרדי עם חיוניות, סגנון ואבזור טוב.',
   'Seat Arona – a Spanish compact crossover with vibrancy, style, and good features.',
   1),

  ('Citroen', 'C4', 2022, 'COMPACT', 'AUTOMATIC', 'GASOLINE', 5, 5, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay'],
   true, false, 'אפור', 'Grey',
   'סיטרואן C4 – קומפקטי צרפתי מעוצב עם נסיעה נוחה ורכה במיוחד.',
   'Citroen C4 – a stylish French compact with an especially smooth and comfortable ride.',
   1),

  ('Chery', 'Arrizo', 2023, 'COMPACT', 'AUTOMATIC', 'GASOLINE', 5, 4, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית'],
   true, false, 'לבן', 'White',
   'צ''רי אריזו – סדאן קומפקטי עם אבזור עשיר ועיצוב מודרני ונקי.',
   'Chery Arrizo – a compact sedan with rich equipment and clean, modern design.',
   1),

  ('Mitsubishi', 'Eclipse Cross', 2023, 'COMPACT', 'AUTOMATIC', 'GASOLINE', 5, 5, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה'],
   true, false, 'שחור', 'Black',
   'מיצובישי אקליפס קרוס – קרוסאובר ספורטיבי עם עיצוב אגרסיבי ואבזור מרשים.',
   'Mitsubishi Eclipse Cross – a sporty crossover with aggressive design and impressive features.',
   1),

  ('Seres', '3', 2023, 'ELECTRIC', 'AUTOMATIC', 'ELECTRIC', 5, 5, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','טעינה מהירה'],
   true, false, 'לבן', 'White',
   'סרס 3 – רכב חשמלי קומפקטי עם טווח מרשים, טעינה מהירה ונהיגה שקטה.',
   'Seres 3 – a compact electric vehicle with impressive range, fast charging, and silent driving.',
   1);

-- ============================================================
-- SEDAN  |  ₪300 / day  |  ₪5,000 / month  |  deposit ₪1,500
-- ============================================================
INSERT INTO vehicles (make, model, year, category, transmission, fuel_type, seats, doors,
  price_per_day, price_per_month, deposit_amount, image_urls, features,
  is_available, is_featured, color_he, color_en, description_he, description_en, total_units)
VALUES
  ('Toyota', 'Corolla', 2024, 'SEDAN', 'AUTOMATIC', 'HYBRID', 5, 4, 300, 5000, 1500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','Toyota Safety Sense','מושבים מחוממים'],
   true, false, 'לבן', 'White',
   'טויוטה קורולה היברידי – הסדאן הנמכר ביותר בעולם. אמין, יעיל ונוח לכל נסיעה.',
   'Toyota Corolla Hybrid – the world best-selling sedan. Reliable, efficient, and comfortable for every trip.',
   6);

-- ============================================================
-- SUV  |  ₪380 / day  |  ₪6,500 / month  |  deposit ₪2,000
-- ============================================================
INSERT INTO vehicles (make, model, year, category, transmission, fuel_type, seats, doors,
  price_per_day, price_per_month, deposit_amount, image_urls, features,
  is_available, is_featured, color_he, color_en, description_he, description_en, total_units)
VALUES
  ('Nissan', 'Qashqai', 2024, 'SUV', 'AUTOMATIC', 'GASOLINE', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה','ניווט','מושבים מחוממים'],
   true, false, 'לבן', 'White',
   'ניסאן קאשקאי – SUV קומפקטי מוביל באירופה עם אבזור עשיר ונהיגה נינוחה.',
   'Nissan Qashqai – Europe leading compact SUV with rich features and a comfortable ride.',
   7),

  ('KIA', 'Sportage', 2024, 'SUV', 'AUTOMATIC', 'GASOLINE', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה','ניווט','מושבים מחוממים'],
   true, true, 'אפור', 'Grey',
   'קיה ספורטאז'' – SUV קוריאני פופולרי עם עיצוב מרהיב ואבזור פרימיום מלא.',
   'KIA Sportage – a popular Korean SUV with stunning design and full premium equipment.',
   11),

  ('KIA', 'Seltos', 2024, 'SUV', 'AUTOMATIC', 'GASOLINE', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה','ניווט'],
   true, false, 'לבן', 'White',
   'קיה סלטוס – SUV קומפקטי עם עיצוב צעיר ומודרני, מרווח ומאובזר.',
   'KIA Seltos – a compact SUV with a young and modern design, spacious and well-equipped.',
   10),

  ('Chery', 'Tiggo 7', 2024, 'SUV', 'AUTOMATIC', 'GASOLINE', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה','ניווט','גג פנורמה'],
   true, false, 'לבן', 'White',
   'צ''רי טיגו 7 – SUV גדול עם ערך לכסף יוצא דופן. מרווח, מאובזר ונוח לנסיעות ארוכות.',
   'Chery Tiggo 7 – a large SUV with exceptional value. Spacious, well-equipped, and comfortable for long trips.',
   17),

  ('Chery', 'Tiggo 8', 2024, 'SUV', 'AUTOMATIC', 'GASOLINE', 7, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה','ניווט','גג פנורמה','7 מושבים'],
   true, false, 'שחור', 'Black',
   'צ''רי טיגו 8 – SUV מרשים בן 7 מושבים עם גג פנורמה ואבזור עשיר.',
   'Chery Tiggo 8 – an impressive 7-seat SUV with a panoramic roof and rich equipment.',
   6),

  ('Chery', 'Tiggo 4', 2024, 'SUV', 'AUTOMATIC', 'GASOLINE', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה'],
   true, false, 'לבן', 'White',
   'צ''רי טיגו 4 – SUV קומפקטי עם אבזור מרשים למחיר ונסיעה נוחה.',
   'Chery Tiggo 4 – a compact SUV with impressive equipment for the price and comfortable ride.',
   15),

  ('Hyundai', 'Kona', 2023, 'SUV', 'AUTOMATIC', 'ELECTRIC', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה','טעינה מהירה'],
   true, false, 'אפור', 'Grey',
   'יונדאי קונה חשמלי – SUV קומפקטי חשמלי עם טווח מרשים ועיצוב מודרני.',
   'Hyundai Kona Electric – a compact electric SUV with impressive range and modern design.',
   1),

  ('KIA', 'Sorento', 2024, 'SUV', 'AUTOMATIC', 'HYBRID', 7, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה','ניווט','7 מושבים','הנעה כפולה AWD'],
   true, false, 'כסוף', 'Silver',
   'קיה סורנטו – SUV גדול בן 7 מושבים עם הנעה כפולה וחסכנות דלק מצוינת.',
   'KIA Sorento – a large 7-seat SUV with AWD and excellent fuel efficiency.',
   2),

  ('Nissan', 'Juke', 2024, 'SUV', 'AUTOMATIC', 'GASOLINE', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה'],
   true, false, 'כתום', 'Orange',
   'ניסאן ג''וק – SUV קומפקטי עם עיצוב ייחודי ואישיות בולטת שאי אפשר להתעלם ממנה.',
   'Nissan Juke – a compact SUV with a unique design and a bold personality impossible to ignore.',
   3),

  ('KIA', 'Niro', 2023, 'SUV', 'AUTOMATIC', 'HYBRID', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה','הייבריד'],
   true, false, 'לבן', 'White',
   'קיה נירו היברידי – SUV ירוק וחסכוני בדלק עם עיצוב עכשווי ונקי.',
   'KIA Niro Hybrid – an eco-friendly, fuel-efficient SUV with a clean contemporary design.',
   1),

  ('Peugeot', '2008', 2023, 'SUV', 'AUTOMATIC', 'GASOLINE', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה','ניווט'],
   true, false, 'אפור', 'Grey',
   'פיז''ו 2008 – SUV צרפתי סגנוני עם פנים מפואר ונסיעה נינוחה ורכה.',
   'Peugeot 2008 – a stylish French SUV with a luxurious interior and soft, comfortable ride.',
   1),

  ('MG', 'ZS', 2023, 'SUV', 'AUTOMATIC', 'GASOLINE', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה'],
   true, false, 'לבן', 'White',
   'MG ZS – SUV בריטי-סיני עם ערך לכסף מצוין ואבזור עשיר במיוחד למחיר.',
   'MG ZS – a British-Chinese SUV with excellent value and especially rich equipment for the price.',
   1),

  ('SsangYong', 'Korando', 2022, 'SUV', 'AUTOMATIC', 'GASOLINE', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה'],
   true, false, 'אפור', 'Grey',
   'סאנגיונג קורנדו – SUV קוריאני אמין עם ביצועים טובים בשטח ובכביש.',
   'SsangYong Korando – a reliable Korean SUV with solid performance on and off road.',
   4),

  ('Seat', 'Ateca', 2023, 'SUV', 'AUTOMATIC', 'GASOLINE', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה'],
   true, false, 'לבן', 'White',
   'סיאט אטקה – SUV קומפקטי ספרדי עם ביצועים מרשימים וסגנון אירופאי.',
   'Seat Ateca – a Spanish compact SUV with impressive performance and European style.',
   1),

  ('Renault', 'Koleos', 2023, 'SUV', 'AUTOMATIC', 'GASOLINE', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה','ניווט'],
   true, false, 'כסוף', 'Silver',
   'רנו קולאוס – SUV צרפתי מרווח ונוח, אידיאלי לנסיעות ארוכות ולמשפחות.',
   'Renault Koleos – a spacious and comfortable French SUV, ideal for long trips and families.',
   1),

  ('Subaru', 'Crosstrek', 2023, 'SUV', 'AUTOMATIC', 'GASOLINE', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','הנעה כפולה AWD','EyeSight'],
   true, false, 'כחול', 'Blue',
   'סובארו קרוסטרק – AWD קבוע לכל שטח עם מערכת EyeSight לבטיחות מרבית.',
   'Subaru Crosstrek – permanent AWD for all terrain with EyeSight for maximum safety.',
   3),

  ('Jaecoo', '7', 2024, 'SUV', 'AUTOMATIC', 'GASOLINE', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','חיישני חניה','ניווט','גג פנורמה'],
   true, false, 'לבן', 'White',
   'ג''אקו 7 – SUV חדשני עם עיצוב ספורטיבי ואבזור ברמה גבוהה.',
   'Jaecoo 7 – an innovative SUV with sporty design and high-level equipment.',
   1);

-- ============================================================
-- ELECTRIC  |  ₪380 / day  |  ₪6,500 / month  |  deposit ₪2,000
-- ============================================================
INSERT INTO vehicles (make, model, year, category, transmission, fuel_type, seats, doors,
  price_per_day, price_per_month, deposit_amount, image_urls, features,
  is_available, is_featured, color_he, color_en, description_he, description_en, total_units)
VALUES
  ('Hyundai', 'Ioniq 5', 2023, 'ELECTRIC', 'AUTOMATIC', 'ELECTRIC', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','טעינה מהירה 800V','ניווט'],
   true, false, 'לבן', 'White',
   'יונדאי איוניק 5 – רכב חשמלי פורץ דרך עם טעינה מהירה במיוחד ועיצוב עתידני.',
   'Hyundai Ioniq 5 – a breakthrough EV with ultra-fast charging and futuristic design.',
   1),

  ('Xpeng', 'G3', 2023, 'ELECTRIC', 'AUTOMATIC', 'ELECTRIC', 5, 5, 380, 6500, 2000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','טעינה מהירה','בינה מלאכותית'],
   true, false, 'לבן', 'White',
   'שיאופנג G3 – SUV חשמלי חכם עם בינה מלאכותית ויכולות אוטופיילוט.',
   'Xpeng G3 – a smart electric SUV with AI features and autopilot capabilities.',
   1);

-- ============================================================
-- LUXURY  |  ₪550 / day  |  ₪9,000 / month  |  deposit ₪3,000
-- ============================================================
INSERT INTO vehicles (make, model, year, category, transmission, fuel_type, seats, doors,
  price_per_day, price_per_month, deposit_amount, image_urls, features,
  is_available, is_featured, color_he, color_en, description_he, description_en, total_units)
VALUES
  ('BMW', '118i', 2024, 'LUXURY', 'AUTOMATIC', 'GASOLINE', 5, 5, 550, 9000, 3000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','מושבי עור','גג פנורמה','מנוע ספורטיבי'],
   true, false, 'שחור', 'Black',
   'BMW סדרה 1 – ניסיון נהיגה ספורטיבי גרמני. הצ''בק היוקרתי שהגדיר מחדש את קטגוריתו.',
   'BMW 1 Series – the German sporty driving experience. The luxury hatchback that redefined its class.',
   2),

  ('BMW', '530e', 2024, 'LUXURY', 'AUTOMATIC', 'HYBRID', 5, 4, 550, 9000, 3000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','ABS','Apple CarPlay','מצלמה אחורית','מושבי עור','גג פנורמה','פלאג-אין היברידי','Harman Kardon'],
   true, false, 'כחול', 'Blue',
   'BMW סדרה 5 530e – סדאן מנהלים עם פלאג-אין היברידי. שילוב מושלם של יוקרה וחסכנות.',
   'BMW 5 Series 530e – executive sedan with plug-in hybrid. Perfect blend of luxury and efficiency.',
   1),

  ('BMW', 'X1', 2024, 'LUXURY', 'AUTOMATIC', 'GASOLINE', 5, 5, 550, 9000, 3000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','ABS','Apple CarPlay','מצלמה אחורית','מושבי עור','גג פנורמה','הנעה כפולה xDrive'],
   true, false, 'לבן', 'White',
   'BMW X1 – SUV קומפקטי יוקרתי עם נהיגה ספורטיבית והנעה כפולה xDrive.',
   'BMW X1 – a luxury compact SUV with sporty driving dynamics and xDrive all-wheel drive.',
   2),

  ('Mercedes-Benz', 'C 180', 2024, 'LUXURY', 'AUTOMATIC', 'GASOLINE', 5, 4, 550, 9000, 3000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','ABS','Apple CarPlay','מצלמה אחורית','מושבי עור','MBUX','Burmester','מתלה אוויר'],
   true, false, 'שחור', 'Black',
   'מרצדס-בנץ C 180 – יוקרה גרמנית מרבית. מערכת MBUX וסגנון שאי אפשר לעמוד בפניו.',
   'Mercedes-Benz C 180 – ultimate German luxury. MBUX technology and an irresistible style.',
   1),

  ('Audi', 'A3', 2024, 'LUXURY', 'AUTOMATIC', 'GASOLINE', 5, 5, 550, 9000, 3000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','ABS','Apple CarPlay','מצלמה אחורית','מושבי עור','לוח מחוונים וירטואלי','מושבים מחוממים'],
   true, false, 'אפור', 'Grey',
   'אאודי A3 – סגנון וטכנולוגיה גרמניים מהדרגה הראשונה. לוח מחוונים וירטואלי מרשים.',
   'Audi A3 – first-class German style and technology. Impressive virtual cockpit dashboard.',
   1),

  ('Hyundai', 'Elantra', 2024, 'LUXURY', 'AUTOMATIC', 'GASOLINE', 5, 4, 550, 9000, 3000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','ניווט','מושבים מחוממים'],
   true, false, 'לבן', 'White',
   'יונדאי אלנטרה – סדאן מרשים עם עיצוב עתידני ואבזור עשיר ומרשים.',
   'Hyundai Elantra – an impressive sedan with futuristic design and rich, striking equipment.',
   3),

  ('Subaru', 'XV', 2023, 'LUXURY', 'AUTOMATIC', 'GASOLINE', 5, 5, 550, 9000, 3000,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','הנעה כפולה Symmetrical AWD','EyeSight'],
   true, false, 'כסוף', 'Silver',
   'סובארו XV – AWD סימטרי קבוע עם מערכת EyeSight. בטיחות מרבית לכל שטח.',
   'Subaru XV – permanent Symmetrical AWD with EyeSight. Maximum safety for all terrain.',
   1);

-- ============================================================
-- VAN  |  ₪500 / day  |  ₪8,000 / month  |  deposit ₪2,500
-- ============================================================
INSERT INTO vehicles (make, model, year, category, transmission, fuel_type, seats, doors,
  price_per_day, price_per_month, deposit_amount, image_urls, features,
  is_available, is_featured, color_he, color_en, description_he, description_en, total_units)
VALUES
  ('Chevrolet', 'Traverse', 2024, 'VAN', 'AUTOMATIC', 'GASOLINE', 7, 5, 500, 8000, 2500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','7 מושבים','מנוע V6'],
   true, false, 'שחור', 'Black',
   'שברולט טרברס – מיניוואן אמריקאי מרשים עם 7 מושבים ומנוע V6 חזק.',
   'Chevrolet Traverse – an impressive American minivan with 7 seats and a powerful V6 engine.',
   2),

  ('Chrysler', 'Grand Voyager', 2023, 'VAN', 'AUTOMATIC', 'GASOLINE', 7, 5, 500, 8000, 2500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','מצלמה אחורית','7 מושבים','דלתות הזזה חשמליות'],
   true, false, 'כסוף', 'Silver',
   'כרייזלר גרנד וויאג''ר – מיניוואן משפחתי קלאסי עם 7 מושבים ודלתות הזזה חשמליות.',
   'Chrysler Grand Voyager – the classic family minivan with 7 seats and electric sliding doors.',
   1),

  ('KIA', 'Carnival', 2024, 'VAN', 'AUTOMATIC', 'GASOLINE', 8, 5, 500, 8000, 2500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','8 מושבים','דלתות הזזה חשמליות'],
   true, false, 'לבן', 'White',
   'קיה קרנבל – המיניוואן הפרימיום. 8 מושבים עם נוחות ואבזור ברמת רכב יוקרה.',
   'KIA Carnival – the premium minivan. 8 seats with the comfort and features of a luxury vehicle.',
   1),

  ('Fiat', 'Doblo', 2023, 'VAN', 'MANUAL', 'DIESEL', 5, 5, 500, 8000, 2500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','מרווח פנים גדול'],
   true, false, 'לבן', 'White',
   'פיאט דובלו – ואן קומפקטי ופרקטי עם שטח פנים מרשים לנסיעות ולהובלה.',
   'Fiat Doblo – a compact and practical van with impressive cargo and passenger space.',
   1),

  ('SsangYong', 'Rexton', 2023, 'VAN', 'AUTOMATIC', 'DIESEL', 7, 5, 500, 8000, 2500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','Apple CarPlay','מצלמה אחורית','7 מושבים','הנעה כפולה'],
   true, false, 'שחור', 'Black',
   'סאנגיונג רקסטון – SUV גדול בן 7 מושבים עם הנעה כפולה ויכולות שטח מרשימות.',
   'SsangYong Rexton – a large 7-seat SUV with AWD and impressive off-road capabilities.',
   2),

  ('Renault', 'Kangoo', 2023, 'VAN', 'MANUAL', 'DIESEL', 5, 5, 500, 8000, 2500,
   ARRAY[]::TEXT[], ARRAY['מיזוג אוויר','Bluetooth','ABS','דלת הזזה'],
   true, false, 'לבן', 'White',
   'רנו קנגו – ואן קומפקטי ופרקטי. מושלם לנסיעות קבוצתיות ולהובלת ציוד.',
   'Renault Kangoo – a compact, practical van. Perfect for group travel and equipment transport.',
   1);

COMMIT;

-- Verify
SELECT category, COUNT(*) AS models, SUM(total_units) AS total_vehicles
FROM vehicles
GROUP BY category
ORDER BY category;
