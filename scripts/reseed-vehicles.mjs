import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';

const sb = createClient(
  'https://iovpoxmdsgsstaduggvb.supabase.co',
  'process.env.SUPABASE_SERVICE_ROLE_KEY'
);

// Delete all existing vehicles
const { error: delErr } = await sb.from('vehicles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
if (delErr) { console.error('Delete failed:', delErr.message); process.exit(1); }
console.log('Deleted all vehicles.');

const vehicles = [
  {
    make: 'קיה', model: 'פיקנטו', year: 2022,
    category: 'ECONOMY', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 250, price_per_month: 2800, deposit_amount: 1500, mileage_limit: 150,
    image_urls: ['/images/vehicles/kia-picanto.jpg'],
    is_available: true, is_featured: true,
    description_he: 'רכב קטן וחסכוני – מושלם לעיר', description_en: 'Small economical car – perfect for the city',
    total_units: 3,
  },
  {
    make: 'מאזדה', model: '2', year: 2021,
    category: 'ECONOMY', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 250, price_per_month: 2800, deposit_amount: 1500, mileage_limit: 150,
    image_urls: ['/images/vehicles/mazda2.jpg'],
    is_available: true, is_featured: false,
    description_he: 'רכב עירוני חסכוני ואמין', description_en: 'Economical and reliable urban car',
    total_units: 3,
  },
  {
    make: 'מאזדה', model: '3', year: 2022,
    category: 'COMPACT', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 350, price_per_month: 3500, deposit_amount: 2000, mileage_limit: 150,
    image_urls: ['/images/vehicles/mazda3.jpg'],
    is_available: true, is_featured: true,
    description_he: 'סדאן קומפקטי פרימיום עם ציוד עשיר', description_en: 'Premium compact sedan with rich equipment',
    total_units: 2,
  },
  {
    make: 'ניסן', model: 'סנטרה', year: 2022,
    category: 'COMPACT', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 350, price_per_month: 3500, deposit_amount: 2000, mileage_limit: 150,
    image_urls: ['/images/vehicles/nissan-sentra.jpg'],
    is_available: true, is_featured: false,
    description_he: 'סדאן נוח ואמין', description_en: 'Comfortable and reliable sedan',
    total_units: 2,
  },
  {
    make: 'קיה', model: 'סטוניק', year: 2022,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 500, price_per_month: 7500, deposit_amount: 2500, mileage_limit: 150,
    image_urls: ['/images/vehicles/kia-stonic.jpg'],
    is_available: true, is_featured: false,
    description_he: 'קרוסאובר קומפקטי ספורטיבי', description_en: 'Sporty compact crossover',
    total_units: 2,
  },
  {
    make: 'קיה', model: 'סלטוס', year: 2023,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 500, price_per_month: 7500, deposit_amount: 2500, mileage_limit: 150,
    image_urls: ['/images/vehicles/kia-seltos.jpg'],
    is_available: true, is_featured: true,
    description_he: 'SUV מרווח ומודרני', description_en: 'Spacious modern SUV',
    total_units: 3,
  },
  {
    make: 'קיה', model: "ספורטאז'", year: 2023,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 500, price_per_month: 7500, deposit_amount: 3000, mileage_limit: 150,
    image_urls: ['/images/vehicles/kia-sportage.jpg'],
    is_available: true, is_featured: true,
    description_he: 'SUV פרימיום בסגנון ספורטיבי', description_en: 'Premium sporty SUV',
    total_units: 2,
  },
  {
    make: 'קיה', model: 'סורנטו', year: 2023,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'HYBRID',
    seats: 7, doors: 4, price_per_day: 500, price_per_month: 7500, deposit_amount: 3500, mileage_limit: 150,
    image_urls: ['/images/vehicles/kia-sorento.jpg'],
    is_available: true, is_featured: false,
    description_he: 'SUV משפחתי היברידי 7 מושבים', description_en: '7-seat hybrid family SUV',
    total_units: 2,
  },
  {
    make: 'טויוטה', model: 'יאריס קרוס', year: 2023,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'HYBRID',
    seats: 5, doors: 4, price_per_day: 500, price_per_month: 7500, deposit_amount: 2800, mileage_limit: 150,
    image_urls: ['/images/vehicles/yaris-cross.jpg'],
    is_available: true, is_featured: true,
    description_he: 'קרוסאובר היברידי חסכוני', description_en: 'Economical hybrid crossover',
    total_units: 4,
  },
  {
    make: 'Chery', model: 'Tiggo 7', year: 2022,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 500, price_per_month: 7500, deposit_amount: 2800, mileage_limit: 150,
    image_urls: ['/images/vehicles/tiggo7.jpg'],
    is_available: true, is_featured: false,
    description_he: 'SUV סיני פרימיום מרווח', description_en: 'Spacious premium Chinese SUV',
    total_units: 2,
  },
  {
    make: 'Chery', model: 'Tiggo 8', year: 2023,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 7, doors: 4, price_per_day: 500, price_per_month: 7500, deposit_amount: 3000, mileage_limit: 150,
    image_urls: ['/images/vehicles/tiggo8.jpg'],
    is_available: true, is_featured: true,
    description_he: 'SUV עם 7 מושבים ותא מטען גדול', description_en: '7-seat SUV with large cargo space',
    total_units: 2,
  },
  {
    make: 'Mitsubishi', model: 'Eclipse Cross', year: 2022,
    category: 'SUV', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 500, price_per_month: 7500, deposit_amount: 2500, mileage_limit: 150,
    image_urls: ['/images/vehicles/eclipse.jpg'],
    is_available: true, is_featured: false,
    description_he: 'קרוסאובר ספורטיבי עם עיצוב ייחודי', description_en: 'Sporty crossover with unique design',
    total_units: 2,
  },
  {
    make: 'קיה', model: 'קרניבל', year: 2022,
    category: 'VAN', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 7, doors: 4, price_per_day: 500, price_per_month: 7500, deposit_amount: 3000, mileage_limit: 150,
    image_urls: ['/images/vehicles/carni.jpg'],
    is_available: true, is_featured: false,
    description_he: 'מיניוואן משפחתי מרווח ומפנק', description_en: 'Spacious and comfortable family minivan',
    total_units: 2,
  },
  {
    make: 'מרצדס', model: 'C180', year: 2022,
    category: 'LUXURY', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 5, doors: 4, price_per_day: 500, price_per_month: 7500, deposit_amount: 5000, mileage_limit: 150,
    image_urls: ['/images/vehicles/mercedes-c180.jpg'],
    is_available: true, is_featured: true,
    description_he: 'סדאן יוקרה גרמני – נסיעה בסגנון', description_en: 'German luxury sedan – travel in style',
    total_units: 1,
  },
  {
    make: 'שברולט', model: 'טרברס', year: 2021,
    category: 'VAN', transmission: 'AUTOMATIC', fuel_type: 'GASOLINE',
    seats: 8, doors: 4, price_per_day: 500, price_per_month: 7500, deposit_amount: 4000, mileage_limit: 200,
    image_urls: ['/images/vehicles/ford-transit.jpg'],
    is_available: true, is_featured: false,
    description_he: 'ואן משפחתי גדול ל-8 נוסעים', description_en: 'Large family van for 8 passengers',
    total_units: 2,
  },
];

const { data, error } = await sb.from('vehicles').insert(vehicles).select('make, model, category');
if (error) {
  console.error('Insert failed:', error.message, error.details);
  process.exit(1);
}
console.log(`Inserted ${data.length} vehicles:`);
data.forEach(v => console.log(' -', v.category, v.make, v.model));
