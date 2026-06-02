import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://iovpoxmdsgsstaduggvb.supabase.co',
  'process.env.SUPABASE_SERVICE_ROLE_KEY'
);

const vehicles = [
  // ── ECONOMY ────────────────────────────────────────────────────
  {
    make: 'קיה', model: 'פיקנטו', year: 2023,
    category: 'ECONOMY', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 220, price_per_month: 3500, deposit_amount: 1000,
    mileage_limit: 150, image_urls: ['/images/vehicles/picanto-1.webp', '/images/vehicles/picanto-2.webp'],
    features: ['מיזוג אוויר', 'בלוטות', 'USB'],
    is_available: true, is_featured: true,
    color_he: 'לבן', color_en: 'White',
    description_he: 'רכב כלכלי וחסכוני, אידיאלי לנסיעות עירוניות.',
    description_en: 'Economical city car, ideal for urban driving.',
    total_units: 4,
  },
  {
    make: 'מאזדה', model: '2', year: 2022,
    category: 'ECONOMY', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 230, price_per_month: 3600, deposit_amount: 1000,
    mileage_limit: 150, image_urls: ['/images/vehicles/mazda2-1.webp', '/images/vehicles/mazda2-2.webp'],
    features: ['מיזוג אוויר', 'בלוטות', 'מצלמה אחורית'],
    is_available: true, is_featured: false,
    color_he: 'כסוף', color_en: 'Silver',
    description_he: 'רכב עירוני מהנה ונוח עם חיסכון בדלק.',
    description_en: 'Fun and comfortable city car with great fuel economy.',
    total_units: 3,
  },
  {
    make: 'טויוטה', model: 'יאריס', year: 2023,
    category: 'ECONOMY', transmission: 'AUTOMATIC', fuel_type: 'HYBRID',
    seats: 5, doors: 4, price_per_day: 250, price_per_month: 3800, deposit_amount: 1000,
    mileage_limit: 150, image_urls: ['/images/vehicles/yaris-1.webp'],
    features: ['מיזוג אוויר', 'בלוטות', 'היברידי', 'Apple CarPlay'],
    is_available: true, is_featured: false,
    color_he: 'לבן', color_en: 'White',
    description_he: 'יאריס היברידי – חסכוני ואחראי לסביבה.',
    description_en: 'Hybrid Yaris – economical and eco-friendly.',
    total_units: 3,
  },

  // ── COMPACT ────────────────────────────────────────────────────
  {
    make: 'מאזדה', model: '3', year: 2023,
    category: 'COMPACT', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 290, price_per_month: 4800, deposit_amount: 1500,
    mileage_limit: 150, image_urls: ['/images/vehicles/mazda3-1.webp', '/images/vehicles/mazda3-2.webp'],
    features: ['מיזוג אוויר', 'בלוטות', 'מצלמה', 'חיישני חניה', 'Apple CarPlay'],
    is_available: true, is_featured: true,
    color_he: 'לבן', color_en: 'White',
    description_he: 'סדאן קומפקטי פרימיום עם עיצוב מרהיב.',
    description_en: 'Premium compact sedan with stunning design.',
    total_units: 2,
  },
  {
    make: 'ניסן', model: 'סנטרה', year: 2022,
    category: 'COMPACT', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 270, price_per_month: 4500, deposit_amount: 1500,
    mileage_limit: 150, image_urls: ['/images/vehicles/sentra-1.webp', '/images/vehicles/sentra-2.webp'],
    features: ['מיזוג אוויר', 'בלוטות', 'Apple CarPlay', 'Android Auto'],
    is_available: true, is_featured: false,
    color_he: 'כחול', color_en: 'Blue',
    description_he: 'סדאן נוח ואמין עם טכנולוגיה מתקדמת.',
    description_en: 'Comfortable and reliable sedan with advanced tech.',
    total_units: 2,
  },

  // ── SUV / CROSSOVER ────────────────────────────────────────────
  {
    make: 'טויוטה', model: 'יאריס קרוס', year: 2023,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'HYBRID',
    seats: 5, doors: 4, price_per_day: 340, price_per_month: 5800, deposit_amount: 2000,
    mileage_limit: 150, image_urls: ['/images/vehicles/yaris-cross-1.webp', '/images/vehicles/yaris-cross-2.webp'],
    features: ['היברידי', 'מיזוג אוויר', 'בלוטות', 'מצלמה', 'Apple CarPlay'],
    is_available: true, is_featured: true,
    color_he: 'לבן', color_en: 'White',
    description_he: 'קרוסאובר היברידי חסכוני ומרווח עם טכנולוגיה מתקדמת.',
    description_en: 'Economical hybrid crossover with spacious cabin and advanced tech.',
    total_units: 4,
  },
  {
    make: 'קיה', model: 'סטוניק', year: 2023,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 310, price_per_month: 5200, deposit_amount: 2000,
    mileage_limit: 150, image_urls: ['/images/vehicles/stonic-1.webp', '/images/vehicles/stonic-2.webp'],
    features: ['מיזוג אוויר', 'בלוטות', 'מצלמה', 'חיישנים'],
    is_available: true, is_featured: false,
    color_he: 'אפור', color_en: 'Gray',
    description_he: 'קרוסאובר קומפקטי ספורטיבי לנסיעות עירוניות ובין-עירוניות.',
    description_en: 'Sporty compact crossover for city and highway driving.',
    total_units: 2,
  },
  {
    make: 'קיה', model: 'סלטוס', year: 2023,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 340, price_per_month: 5800, deposit_amount: 2000,
    mileage_limit: 150, image_urls: ['/images/vehicles/seltos-1.webp', '/images/vehicles/seltos-2.webp'],
    features: ['מיזוג אוויר', 'בלוטות', 'מצלמה 360', 'Android Auto'],
    is_available: true, is_featured: true,
    color_he: 'לבן', color_en: 'White',
    description_he: 'SUV מרווח ומודרני עם ציוד עשיר לשיטוט בטוח.',
    description_en: 'Spacious modern SUV with rich equipment for confident driving.',
    total_units: 3,
  },
  {
    make: 'קיה', model: "ספורטאז'", year: 2023,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 370, price_per_month: 6200, deposit_amount: 2000,
    mileage_limit: 150, image_urls: ['/images/vehicles/sportage-1.webp', '/images/vehicles/sportage-2.webp'],
    features: ['מיזוג 2 אזורים', 'בלוטות', 'מצלמה 360', 'עיצוב פרימיום'],
    is_available: true, is_featured: true,
    color_he: 'שחור', color_en: 'Black',
    description_he: "SUV פרימיום מרשים – הספורטאז' החדש עם חוויית נהיגה יוצאת דופן.",
    description_en: 'Impressive premium SUV – the new Sportage with an exceptional driving experience.',
    total_units: 2,
  },
  {
    make: 'קיה', model: 'סורנטו', year: 2023,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'HYBRID',
    seats: 7, doors: 4, price_per_day: 420, price_per_month: 7000, deposit_amount: 2500,
    mileage_limit: 150, image_urls: ['/images/vehicles/sorento-1.webp', '/images/vehicles/sorento-2.webp'],
    features: ['היברידי', 'מיזוג 3 אזורים', '7 מושבים', 'מסך ענק', 'Apple CarPlay'],
    is_available: true, is_featured: false,
    color_he: 'לבן', color_en: 'White',
    description_he: 'SUV משפחתי היברידי עם 7 מושבים ועיצוב מפואר.',
    description_en: '7-seat hybrid family SUV with luxurious design.',
    total_units: 2,
  },
  {
    make: 'Chery', model: 'Tiggo 7', year: 2023,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 330, price_per_month: 5500, deposit_amount: 2000,
    mileage_limit: 150, image_urls: ['/images/vehicles/tiggo7-1.webp', '/images/vehicles/tiggo7-2.webp'],
    features: ['מיזוג אוויר', 'בלוטות', 'מצלמה', 'מושבים מחוממים'],
    is_available: true, is_featured: false,
    color_he: 'לבן', color_en: 'White',
    description_he: 'SUV מרווח עם ציוד עשיר ומחיר תחרותי.',
    description_en: 'Spacious SUV with rich equipment at a competitive price.',
    total_units: 2,
  },
  {
    make: 'Chery', model: 'Tiggo 8', year: 2023,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 7, doors: 4, price_per_day: 380, price_per_month: 6400, deposit_amount: 2200,
    mileage_limit: 150, image_urls: ['/images/vehicles/tiggo8-1.webp', '/images/vehicles/tiggo8-2.webp'],
    features: ['7 מושבים', 'מיזוג', 'בלוטות', 'מצלמה 360'],
    is_available: true, is_featured: false,
    color_he: 'אדום', color_en: 'Red',
    description_he: 'SUV 7 מושבים מרווח לכל המשפחה.',
    description_en: 'Spacious 7-seat SUV perfect for the whole family.',
    total_units: 2,
  },
  {
    make: 'Mitsubishi', model: 'Eclipse Cross', year: 2023,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 340, price_per_month: 5700, deposit_amount: 2000,
    mileage_limit: 150, image_urls: ['/images/vehicles/eclipse-1.webp', '/images/vehicles/eclipse-2.webp'],
    features: ['מיזוג אוויר', 'בלוטות', 'מצלמה', 'עיצוב ספורטיבי'],
    is_available: true, is_featured: false,
    color_he: 'כחול', color_en: 'Blue',
    description_he: 'קרוסאובר ספורטיבי עם מראה אגרסיבי וביצועים מצוינים.',
    description_en: 'Sporty crossover with aggressive look and excellent performance.',
    total_units: 2,
  },
  {
    make: 'FX', model: 'SUV', year: 2022,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 300, price_per_month: 5000, deposit_amount: 2000,
    mileage_limit: 150, image_urls: ['/images/vehicles/fx-1.webp', '/images/vehicles/fx-2.webp'],
    features: ['מיזוג', 'בלוטות', 'מצלמה'],
    is_available: true, is_featured: false,
    color_he: 'אפור', color_en: 'Gray',
    description_he: 'SUV מרווח ואמין לכל סוג נסיעה.',
    description_en: 'Spacious and reliable SUV for any type of trip.',
    total_units: 2,
  },

  // ── LUXURY ────────────────────────────────────────────────────
  {
    make: 'מרצדס', model: 'C180', year: 2023,
    category: 'LUXURY', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 550, price_per_month: 9000, deposit_amount: 3000,
    mileage_limit: 150, image_urls: ['/images/vehicles/c180-1.webp', '/images/vehicles/c180-2.webp'],
    features: ['עור', 'מיזוג 2 אזורים', 'מסך דיגיטלי', 'Apple CarPlay', 'מושבים מחוממים'],
    is_available: true, is_featured: true,
    color_he: 'שחור', color_en: 'Black',
    description_he: 'סדאן יוקרה קלאסי – החוויה הגרמנית המושלמת.',
    description_en: 'Classic luxury sedan – the perfect German experience.',
    total_units: 1,
  },

  // ── VAN ───────────────────────────────────────────────────────
  {
    make: 'קיה', model: 'קרניבל', year: 2023,
    category: 'VAN', transmission: 'AUTOMATIC', fuel_type: 'DIESEL',
    seats: 8, doors: 4, price_per_day: 500, price_per_month: 8000, deposit_amount: 2500,
    mileage_limit: 200, image_urls: ['/images/vehicles/carnival-1.webp', '/images/vehicles/carnival-2.webp'],
    features: ['8 מושבים', 'מיזוג', 'מסך גדול', 'בלוטות', 'פתיחת דלת חשמלית'],
    is_available: true, is_featured: false,
    color_he: 'לבן', color_en: 'White',
    description_he: 'מיניוואן יוקרתי ל-8 נוסעים – מושלם לנסיעות משפחתיות וקבוצתיות.',
    description_en: 'Luxury minivan for 8 passengers – perfect for family and group trips.',
    total_units: 2,
  },
  {
    make: 'שברולט', model: 'טרברס', year: 2022,
    category: 'VAN', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 7, doors: 4, price_per_day: 480, price_per_month: 7800, deposit_amount: 2500,
    mileage_limit: 200, image_urls: ['/images/vehicles/traverse-1.webp', '/images/vehicles/traverse-2.webp'],
    features: ['7 מושבים', 'מיזוג', 'מסך גדול', 'בלוטות', 'Apple CarPlay'],
    is_available: true, is_featured: false,
    color_he: 'כסוף', color_en: 'Silver',
    description_he: 'מיניוואן אמריקאי מרווח ל-7 נוסעים עם ציוד עשיר.',
    description_en: 'Spacious American minivan for 7 passengers with rich equipment.',
    total_units: 2,
  },
];

async function seed() {
  console.log('Deleting existing vehicles...');
  const { error: delErr } = await sb.from('vehicles').delete().neq('id', 'none');
  if (delErr) { console.error('Delete error:', delErr.message); process.exit(1); }

  console.log(`Inserting ${vehicles.length} vehicles...`);
  const { data, error } = await sb.from('vehicles').insert(vehicles).select('id,make,model');
  if (error) { console.error('Insert error:', error.message, error.details); process.exit(1); }

  console.log(`✓ Inserted ${data.length} vehicles:`);
  data.forEach(v => console.log(`  ${v.make} ${v.model}`));
}

seed();
