import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iovpoxmdsgsstaduggvb.supabase.co';
const SERVICE_ROLE_KEY = 'process.env.SUPABASE_SERVICE_ROLE_KEY';
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/vehicles/`;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// For each vehicle key: main image (front_3_4 = existing), + doors_open, rear_3_4, side_profile
const angleMap = {
  'bmw_1_series_2026_white_front_3_4.png':  { doors: 'bmw_1_series_2026_white_front_3_4_doors_open.png',  rear: 'bmw_1_series_2026_white_rear_3_4.png',  side: 'bmw_1_series_2026_white_side_profile.png' },
  'bmw_5_series_2024_white_front_3_4.png':  { doors: 'bmw_5_series_2024_white_front_3_4_doors_open.png',  rear: 'bmw_5_series_2024_white_rear_3_4.png',  side: 'bmw_5_series_2024_white_side_profile.png' },
  'bmw_x1_2025_black_front_3_4.png':        { doors: 'bmw_x1_2025_black_front_3_4_doors_open.png',        rear: 'bmw_x1_2025_black_rear_3_4.png',        side: 'bmw_x1_2025_black_side_profile.png' },
  'chery_fx_2025_white_corrected_front_3_4.png': { doors: 'chery_fx_2025_white_corrected_front_3_4_doors_open.png', rear: 'chery_fx_2025_white_corrected_rear_3_4.png', side: 'chery_fx_2025_white_corrected_side_profile.png' },
  'chery_tiggo_4_2025_white_front_3_4.png': { doors: 'chery_tiggo_4_2025_white_front_3_4_doors_open.png', rear: 'chery_tiggo_4_2025_white_rear_3_4.png', side: 'chery_tiggo_4_2025_white_side_profile.png' },
  'chery_tiggo_7_2024_white_front_3_4.png': { doors: 'chery_tiggo_7_2024_white_front_3_4_doors_open.png', rear: 'chery_tiggo_7_2024_white_rear_3_4.png', side: 'chery_tiggo_7_2024_white_side_profile.png' },
  'chery_tiggo_8_2025_white_front_3_4.png': { doors: 'chery_tiggo_8_2025_white_front_3_4_doors_open.png', rear: 'chery_tiggo_8_2025_white_rear_3_4.png', side: 'chery_tiggo_8_2025_white_side_profile.png' },
  'chevrolet_traverse_2025_white_front_3_4.png': { doors: 'chevrolet_traverse_2025_white_front_3_4_doors_open.png', rear: 'chevrolet_traverse_2025_white_rear_3_4.png', side: 'chevrolet_traverse_2025_white_side_profile.png' },
  'citroen_berlingo_2025_white_front_3_4.png': { doors: 'citroen_berlingo_2025_white_front_3_4_doors_open.png', rear: 'citroen_berlingo_2025_white_rear_3_4.png', side: 'citroen_berlingo_2025_white_side_profile.png' },
  'citroen_c4_2025_white_front_3_4.png':     { doors: 'citroen_c4_2025_white_front_3_4_doors_open.png',     rear: 'citroen_c4_2025_white_rear_3_4.png',     side: 'citroen_c4_2025_white_side_profile.png' },
  'ford_transit_2024_white_front_3_4.png':   { doors: 'ford_transit_2024_white_front_3_4_doors_open.png',   rear: 'ford_transit_2024_white_rear_3_4.png',   side: 'ford_transit_2024_white_side_profile.png' },
  'hyundai_i10_2025_white_front_3_4.png':    { doors: 'hyundai_i10_2025_white_front_3_4_doors_open.png',    rear: 'hyundai_i10_2025_white_rear_3_4.png',    side: 'hyundai_i10_2025_white_side_profile.png' },
  'kia_carnival_2024_white_front_3_4.png':   { doors: 'kia_carnival_2024_white_front_3_4_doors_open.png',   rear: 'kia_carnival_2024_white_rear_3_4.png',   side: 'kia_carnival_2024_white_side_profile.png' },
  'kia_picanto_2024_white_front_3_4.png':    { doors: 'kia_picanto_2024_white_front_3_4_doors_open.png',    rear: 'kia_picanto_2024_white_rear_3_4.png',    side: 'kia_picanto_2024_white_side_profile.png' },
  'kia_sorento_2025_white_front_3_4.png':    { doors: 'kia_sorento_2025_white_front_3_4_doors_open.png',    rear: 'kia_sorento_2025_white_rear_3_4.png',    side: 'kia_sorento_2025_white_side_profile.png' },
  'kia_sportage_2025_white_front_3_4.png':   { doors: 'kia_sportage_2025_white_front_3_4_doors_open.png',   rear: 'kia_sportage_2025_white_rear_3_4.png',   side: 'kia_sportage_2025_white_side_profile.png' },
  'kia_stonic_2024_white_front_3_4.png':     { doors: 'kia_stonic_2024_white_front_3_4_doors_open.png',     rear: 'kia_stonic_2024_white_rear_3_4.png',     side: 'kia_stonic_2024_white_side_profile.png' },
  'mazda_2_2024_white_redone_front_3_4.png': { doors: 'mazda_2_2024_white_redone_front_3_4_doors_open.png', rear: 'mazda_2_2024_white_redone_rear_3_4.png', side: 'mazda_2_2024_white_redone_side_profile.png' },
  'mazda_3_sedan_2025_white_front_3_4.png':  { doors: 'mazda_3_sedan_2025_white_front_3_4_doors_open.png',  rear: 'mazda_3_sedan_2025_white_rear_3_4.png',  side: 'mazda_3_sedan_2025_white_side_profile.png' },
  'mitsubishi_eclipse_cross_2024_white_front_3_4.png': { doors: 'mitsubishi_eclipse_cross_2024_white_front_3_4_doors_open.png', rear: 'mitsubishi_eclipse_cross_2024_white_rear_3_4.png', side: 'mitsubishi_eclipse_cross_2024_white_side_profile.png' },
  'nissan_sentra_2025_white_front_3_4.png':  { doors: 'nissan_sentra_2025_white_front_3_4_doors_open.png',  rear: 'nissan_sentra_2025_white_rear_3_4.png',  side: 'nissan_sentra_2025_white_side_profile.png' },
  // Toyota Yaris - special filenames
  'toyota_yaris_2025_white_corrected_front_3_4_front.png': { doors: 'toyota_yaris_2025_white_corrected_front_3_4_doors_open.png', rear: 'toyota_yaris_2025_white_no_plate_rear_3_4.png', side: 'toyota_yaris_2025_white_corrected_side_profile.png' },
  'toyota_yaris_cross_2025_white_front_3_4.png': { doors: 'toyota_yaris_cross_2025_white_front_3_4_doors_open.png', rear: 'toyota_yaris_cross_2025_white_rear_3_4.png', side: 'toyota_yaris_cross_2025_white_side_profile.png' },
  // Kia Picanto 2025 (year mismatch — same images as 2024)
  // Mazda 2 2025, Mazda 3 2024 (year mismatch — same images)
};

// Also handle Chery FX grey variant (some vehicles might have the grey version)
angleMap['chery_fx_2025_grey_corrected_front_3_4.png'] = {
  doors: 'chery_fx_2025_grey_corrected_front_3_4_doors_open.png',
  rear: 'chery_fx_2025_grey_corrected_rear_3_4.png',
  side: 'chery_fx_2025_grey_corrected_side_profile.png'
};

// Nissan Sentra black variant
angleMap['nissan_sentra_2025_black_front_3_4.png'] = {
  doors: 'nissan_sentra_2025_black_front_3_4_doors_open.png',
  rear: 'nissan_sentra_2025_black_rear_3_4.png',
  side: 'nissan_sentra_2025_black_side_profile.png'
};

const { data: vehicles, error } = await supabase
  .from('vehicles')
  .select('id, make, model, year, image_urls');

if (error) { console.error(error.message); process.exit(1); }

let fixed = 0;
let skipped = 0;

for (const v of vehicles) {
  const urls = v.image_urls ?? [];
  if (urls.length < 2) continue; // already single image, skip

  const mainUrl = urls[0];
  const mainFile = mainUrl.split('/').pop();

  const angles = angleMap[mainFile];
  if (!angles) {
    // Has multiple images but we don't know the angles — skip
    skipped++;
    continue;
  }

  // Build correct 4-image array: [main(front_3_4), doors_open, rear_3_4, side_profile]
  const newUrls = [
    mainUrl,
    `${STORAGE_BASE}${angles.doors}`,
    `${STORAGE_BASE}${angles.rear}`,
    `${STORAGE_BASE}${angles.side}`,
  ];

  // Check if already correct (no dup at position 1)
  if (urls[1] === newUrls[1] && urls[2] === newUrls[2] && urls[3] === newUrls[3]) {
    skipped++;
    continue;
  }

  const { error: upErr } = await supabase.from('vehicles').update({ image_urls: newUrls }).eq('id', v.id);
  if (upErr) console.error(`  ERROR ${v.make} ${v.model} ${v.year}:`, upErr.message);
  else { console.log(`  ✓ ${v.make} ${v.model} ${v.year} → [main, doors_open, rear_3_4, side_profile]`); fixed++; }
}

console.log(`\nFixed: ${fixed} | Skipped: ${skipped}`);
