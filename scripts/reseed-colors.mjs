import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';

const sb = createClient(
  'https://iovpoxmdsgsstaduggvb.supabase.co',
  'process.env.SUPABASE_SERVICE_ROLE_KEY'
);

// Each model gets 3 color variants; each color uses a different angle image
const MODELS = [
  {
    make: 'Kia', model: 'Picanto', year: 2024, category: 'ECONOMY',
    transmission: 'AUTOMATIC', fuel_type: 'GASOLINE', seats: 5, doors: 4,
    price_per_day: 250, price_per_month: 2800, deposit_amount: 1500, mileage_limit: 150,
    images: ['/images/vehicles/picanto-1.webp', '/images/vehicles/picanto-2.webp', '/images/vehicles/picanto-3.webp'],
    is_featured: true, desc_he: 'רכב קטן וחסכוני', desc_en: 'Small economical car',
  },
  {
    make: 'Mazda', model: '2', year: 2024, category: 'ECONOMY',
    transmission: 'AUTOMATIC', fuel_type: 'GASOLINE', seats: 5, doors: 4,
    price_per_day: 250, price_per_month: 2800, deposit_amount: 1500, mileage_limit: 150,
    images: ['/images/vehicles/mazda2-1.webp', '/images/vehicles/mazda2-2.webp', '/images/vehicles/mazda2-3.webp'],
    is_featured: false, desc_he: 'רכב עירוני חסכוני', desc_en: 'Urban economical car',
  },
  {
    make: 'Mazda', model: '3', year: 2025, category: 'COMPACT',
    transmission: 'AUTOMATIC', fuel_type: 'GASOLINE', seats: 5, doors: 4,
    price_per_day: 350, price_per_month: 3500, deposit_amount: 2000, mileage_limit: 150,
    images: ['/images/vehicles/mazda3-1.webp', '/images/vehicles/mazda3-2.webp', '/images/vehicles/mazda3-3.webp'],
    is_featured: true, desc_he: 'סדאן קומפקטי', desc_en: 'Compact sedan',
  },
  {
    make: 'Nissan', model: 'Sentra', year: 2025, category: 'COMPACT',
    transmission: 'AUTOMATIC', fuel_type: 'GASOLINE', seats: 5, doors: 4,
    price_per_day: 350, price_per_month: 3500, deposit_amount: 2000, mileage_limit: 150,
    images: ['/images/vehicles/sentra-1.webp', '/images/vehicles/sentra-2.webp', '/images/vehicles/sentra-3.webp'],
    is_featured: false, desc_he: 'סדאן נוח ואמין', desc_en: 'Comfortable sedan',
  },
  {
    make: 'Kia', model: 'Stonic', year: 2024, category: 'SUV',
    transmission: 'AUTOMATIC', fuel_type: 'GASOLINE', seats: 5, doors: 4,
    price_per_day: 500, price_per_month: 7500, deposit_amount: 2500, mileage_limit: 150,
    images: ['/images/vehicles/stonic-1.webp', '/images/vehicles/stonic-2.webp', '/images/vehicles/stonic-3.webp'],
    is_featured: false, desc_he: 'קרוסאובר קומפקטי', desc_en: 'Compact crossover',
  },
  {
    make: 'Kia', model: 'Seltos', year: 2025, category: 'SUV',
    transmission: 'AUTOMATIC', fuel_type: 'GASOLINE', seats: 5, doors: 4,
    price_per_day: 500, price_per_month: 7500, deposit_amount: 2500, mileage_limit: 150,
    images: ['/images/vehicles/seltos-1.webp', '/images/vehicles/seltos-2.webp', '/images/vehicles/seltos-3.webp'],
    is_featured: true, desc_he: 'SUV מרווח', desc_en: 'Spacious SUV',
  },
  {
    make: 'Kia', model: 'Sportage', year: 2025, category: 'SUV',
    transmission: 'AUTOMATIC', fuel_type: 'GASOLINE', seats: 5, doors: 4,
    price_per_day: 500, price_per_month: 7500, deposit_amount: 3000, mileage_limit: 150,
    images: ['/images/vehicles/sportage-1.webp', '/images/vehicles/sportage-2.webp', '/images/vehicles/sportage-3.webp'],
    is_featured: true, desc_he: 'SUV פרימיום', desc_en: 'Premium SUV',
  },
  {
    make: 'Kia', model: 'Sorento', year: 2025, category: 'SUV',
    transmission: 'AUTOMATIC', fuel_type: 'HYBRID', seats: 7, doors: 4,
    price_per_day: 500, price_per_month: 7500, deposit_amount: 3500, mileage_limit: 150,
    images: ['/images/vehicles/sorento-1.webp', '/images/vehicles/sorento-2.webp', '/images/vehicles/sorento-3.webp'],
    is_featured: false, desc_he: 'SUV משפחתי 7 מושבים', desc_en: 'Family SUV 7 seats',
  },
  {
    make: 'Toyota', model: 'Yaris Cross', year: 2025, category: 'SUV',
    transmission: 'AUTOMATIC', fuel_type: 'HYBRID', seats: 5, doors: 4,
    price_per_day: 500, price_per_month: 7500, deposit_amount: 2800, mileage_limit: 150,
    images: ['/images/vehicles/yaris-1.webp', '/images/vehicles/yaris-2.webp', '/images/vehicles/yaris-3.webp'],
    is_featured: true, desc_he: 'קרוסאובר היברידי', desc_en: 'Hybrid crossover',
  },
  {
    make: 'Chery', model: 'Tiggo 7', year: 2024, category: 'SUV',
    transmission: 'AUTOMATIC', fuel_type: 'GASOLINE', seats: 5, doors: 4,
    price_per_day: 500, price_per_month: 7500, deposit_amount: 2800, mileage_limit: 150,
    images: ['/images/vehicles/tiggo7-1.webp', '/images/vehicles/tiggo7-2.webp', '/images/vehicles/tiggo7-3.webp'],
    is_featured: false, desc_he: 'SUV מודרני', desc_en: 'Modern SUV',
  },
  {
    make: 'Chery', model: 'Tiggo 8', year: 2025, category: 'SUV',
    transmission: 'AUTOMATIC', fuel_type: 'GASOLINE', seats: 7, doors: 4,
    price_per_day: 500, price_per_month: 7500, deposit_amount: 3000, mileage_limit: 150,
    images: ['/images/vehicles/tiggo8-1.webp', '/images/vehicles/tiggo8-2.webp', '/images/vehicles/tiggo8-3.webp'],
    is_featured: true, desc_he: 'SUV 7 מושבים', desc_en: '7-seat SUV',
  },
  {
    make: 'Mitsubishi', model: 'Eclipse Cross', year: 2024, category: 'SUV',
    transmission: 'AUTOMATIC', fuel_type: 'GASOLINE', seats: 5, doors: 4,
    price_per_day: 500, price_per_month: 7500, deposit_amount: 2500, mileage_limit: 150,
    images: ['/images/vehicles/eclipse-1.webp', '/images/vehicles/eclipse-2.webp', '/images/vehicles/eclipse-3.webp'],
    is_featured: false, desc_he: 'קרוסאובר ספורטיבי', desc_en: 'Sporty crossover',
  },
  {
    make: 'Kia', model: 'Carnival', year: 2024, category: 'VAN',
    transmission: 'AUTOMATIC', fuel_type: 'GASOLINE', seats: 7, doors: 4,
    price_per_day: 500, price_per_month: 7500, deposit_amount: 3000, mileage_limit: 150,
    images: ['/images/vehicles/carni-1.webp', '/images/vehicles/carni-2.webp', '/images/vehicles/carni-3.webp'],
    is_featured: false, desc_he: 'מיניוואן משפחתי', desc_en: 'Family minivan',
  },
  {
    make: 'Mercedes', model: 'C180', year: 2025, category: 'LUXURY',
    transmission: 'AUTOMATIC', fuel_type: 'GASOLINE', seats: 5, doors: 4,
    price_per_day: 500, price_per_month: 7500, deposit_amount: 5000, mileage_limit: 150,
    images: ['/images/vehicles/c180-1.webp', '/images/vehicles/c180-2.webp', '/images/vehicles/c180-3.webp'],
    is_featured: true, desc_he: 'סדאן יוקרה', desc_en: 'Luxury sedan',
  },
  {
    make: 'Ford', model: 'Transit', year: 2024, category: 'VAN',
    transmission: 'MANUAL', fuel_type: 'DIESEL', seats: 8, doors: 4,
    price_per_day: 500, price_per_month: 7500, deposit_amount: 4000, mileage_limit: 200,
    images: ['/images/vehicles/transit-1.webp', '/images/vehicles/transit-2.webp', '/images/vehicles/transit-3.webp'],
    is_featured: false, desc_he: 'ואן מסחרי גדול', desc_en: 'Large commercial van',
  },
];

const COLORS = [
  { color_he: 'לבן',  color_en: 'White', idx: 0, is_featured_override: true  },
  { color_he: 'שחור', color_en: 'Black', idx: 1, is_featured_override: false },
  { color_he: 'אפור', color_en: 'Gray',  idx: 2, is_featured_override: false },
];

const { error: delErr } = await sb.from('vehicles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
if (delErr) { console.error('Delete failed:', delErr.message); process.exit(1); }
console.log('Deleted all vehicles.');

const rows = [];
for (const m of MODELS) {
  for (const c of COLORS) {
    rows.push({
      make: m.make, model: m.model, year: m.year,
      category: m.category, transmission: m.transmission, fuel_type: m.fuel_type,
      seats: m.seats, doors: m.doors,
      price_per_day: m.price_per_day, price_per_month: m.price_per_month,
      deposit_amount: m.deposit_amount, mileage_limit: m.mileage_limit,
      image_urls: [m.images[c.idx] ?? m.images[0]],
      is_available: true,
      is_featured: m.is_featured && c.is_featured_override,
      description_he: m.desc_he, description_en: m.desc_en,
      total_units: 1,
      color_he: c.color_he, color_en: c.color_en,
    });
  }
}

const { data, error } = await sb.from('vehicles').insert(rows).select('make,model,color_en,image_urls');
if (error) { console.error('Insert failed:', error.message, error.details); process.exit(1); }

console.log(`Inserted ${data.length} vehicles (${MODELS.length} models × 3 colors):`);
const seen = new Set();
data.forEach(v => {
  const key = `${v.make} ${v.model}`;
  if (!seen.has(key)) { seen.add(key); console.log(' ', key, '→', v.image_urls?.[0]); }
});
