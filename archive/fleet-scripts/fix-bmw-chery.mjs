import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iovpoxmdsgsstaduggvb.supabase.co';
const SERVICE_ROLE_KEY = 'process.env.SUPABASE_SERVICE_ROLE_KEY';
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/vehicles/`;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Fixes for model name mismatches
const fixes = [
  // BMW Series 1 (DB model = "Series 1", file = bmw_1_series_2026)
  {
    make: 'BMW', modelPattern: 'series 1',
    angles: {
      front_3_4: 'bmw_1_series_2026_white_front_3_4.png',
      rear_3_4: 'bmw_1_series_2026_white_rear_3_4.png',
      side_profile: 'bmw_1_series_2026_white_side_profile.png',
    }
  },
  // BMW Series 5 (DB model = "Series 5", file = bmw_5_series_2024)
  {
    make: 'BMW', modelPattern: 'series 5',
    angles: {
      front_3_4: 'bmw_5_series_2024_white_front_3_4.png',
      rear_3_4: 'bmw_5_series_2024_white_rear_3_4.png',
      side_profile: 'bmw_5_series_2024_white_side_profile.png',
    }
  },
  // Chery Tiggo 4 Pro — use Tiggo 4 images
  {
    make: 'Chery', modelPattern: 'tiggo 4 pro',
    angles: {
      front_3_4: 'chery_tiggo_4_2025_white_front_3_4.png',
      rear_3_4: 'chery_tiggo_4_2025_white_rear_3_4.png',
      side_profile: 'chery_tiggo_4_2025_white_side_profile.png',
    }
  },
];

const { data: vehicles, error } = await supabase
  .from('vehicles')
  .select('id, make, model, year, image_urls');

if (error) { console.error(error.message); process.exit(1); }

let count = 0;
for (const v of vehicles) {
  const fix = fixes.find(f =>
    f.make.toLowerCase() === v.make.toLowerCase() &&
    v.model.toLowerCase().includes(f.modelPattern)
  );
  if (!fix) continue;

  const existing = v.image_urls?.[0];
  if (!existing) continue;

  const newUrls = [
    existing,
    `${STORAGE_BASE}${fix.angles.front_3_4}`,
    `${STORAGE_BASE}${fix.angles.rear_3_4}`,
    `${STORAGE_BASE}${fix.angles.side_profile}`,
  ];

  const { error: upErr } = await supabase.from('vehicles').update({ image_urls: newUrls }).eq('id', v.id);
  if (upErr) console.error(`  ERROR ${v.make} ${v.model} ${v.year}:`, upErr.message);
  else { console.log(`  ✓ ${v.make} ${v.model} ${v.year} → 4 images`); count++; }
}

console.log(`\nFixed ${count} additional vehicles.`);
