import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iovpoxmdsgsstaduggvb.supabase.co';
const SERVICE_ROLE_KEY = 'process.env.SUPABASE_SERVICE_ROLE_KEY';
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/vehicles/`;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Angle image map built from uploaded files
const vehicleAngleMap = {
  'bmw|1_series|2026': { front_3_4: 'bmw_1_series_2026_white_front_3_4.png', rear_3_4: 'bmw_1_series_2026_white_rear_3_4.png', side_profile: 'bmw_1_series_2026_white_side_profile.png' },
  'bmw|5_series|2024': { front_3_4: 'bmw_5_series_2024_white_front_3_4.png', rear_3_4: 'bmw_5_series_2024_white_rear_3_4.png', side_profile: 'bmw_5_series_2024_white_side_profile.png' },
  'bmw|x1|2025':       { front_3_4: 'bmw_x1_2025_black_front_3_4.png', rear_3_4: 'bmw_x1_2025_black_rear_3_4.png', side_profile: 'bmw_x1_2025_black_side_profile.png' },
  'chery|fx|2025':     { front_3_4: 'chery_fx_2025_white_corrected_front_3_4.png', rear_3_4: 'chery_fx_2025_white_corrected_rear_3_4.png', side_profile: 'chery_fx_2025_white_corrected_side_profile.png' },
  'chery|tiggo_4|2025':{ front_3_4: 'chery_tiggo_4_2025_white_front_3_4.png', rear_3_4: 'chery_tiggo_4_2025_white_rear_3_4.png', side_profile: 'chery_tiggo_4_2025_white_side_profile.png' },
  'chery|tiggo_7|2024':{ front_3_4: 'chery_tiggo_7_2024_white_front_3_4.png', rear_3_4: 'chery_tiggo_7_2024_white_rear_3_4.png', side_profile: 'chery_tiggo_7_2024_white_side_profile.png' },
  'chery|tiggo_8|2025':{ front_3_4: 'chery_tiggo_8_2025_white_front_3_4.png', rear_3_4: 'chery_tiggo_8_2025_white_rear_3_4.png', side_profile: 'chery_tiggo_8_2025_white_side_profile.png' },
  'chevrolet|traverse|2025': { front_3_4: 'chevrolet_traverse_2025_white_front_3_4.png', rear_3_4: 'chevrolet_traverse_2025_white_rear_3_4.png', side_profile: 'chevrolet_traverse_2025_white_side_profile.png' },
  'citroen|berlingo|2025': { front_3_4: 'citroen_berlingo_2025_white_front_3_4.png', rear_3_4: 'citroen_berlingo_2025_white_rear_3_4.png', side_profile: 'citroen_berlingo_2025_white_side_profile.png' },
  'citroen|c4|2025':   { front_3_4: 'citroen_c4_2025_white_front_3_4.png', rear_3_4: 'citroen_c4_2025_white_rear_3_4.png', side_profile: 'citroen_c4_2025_white_side_profile.png' },
  'ford|transit|2024': { front_3_4: 'ford_transit_2024_white_front_3_4.png', rear_3_4: 'ford_transit_2024_white_rear_3_4.png', side_profile: 'ford_transit_2024_white_side_profile.png' },
  'hyundai|i10|2025':  { front_3_4: 'hyundai_i10_2025_white_front_3_4.png', rear_3_4: 'hyundai_i10_2025_white_rear_3_4.png', side_profile: 'hyundai_i10_2025_white_side_profile.png' },
  'kia|carnival|2024': { front_3_4: 'kia_carnival_2024_white_front_3_4.png', rear_3_4: 'kia_carnival_2024_white_rear_3_4.png', side_profile: 'kia_carnival_2024_white_side_profile.png' },
  'kia|picanto|2024':  { front_3_4: 'kia_picanto_2024_white_front_3_4.png', rear_3_4: 'kia_picanto_2024_white_rear_3_4.png', side_profile: 'kia_picanto_2024_white_side_profile.png' },
  'kia|sorento|2025':  { front_3_4: 'kia_sorento_2025_white_front_3_4.png', rear_3_4: 'kia_sorento_2025_white_rear_3_4.png', side_profile: 'kia_sorento_2025_white_side_profile.png' },
  'kia|sportage|2025': { front_3_4: 'kia_sportage_2025_white_front_3_4.png', rear_3_4: 'kia_sportage_2025_white_rear_3_4.png', side_profile: 'kia_sportage_2025_white_side_profile.png' },
  'kia|stonic|2024':   { front_3_4: 'kia_stonic_2024_white_front_3_4.png', rear_3_4: 'kia_stonic_2024_white_rear_3_4.png', side_profile: 'kia_stonic_2024_white_side_profile.png' },
  'mazda|2|2024':      { front_3_4: 'mazda_2_2024_white_redone_front_3_4.png', rear_3_4: 'mazda_2_2024_white_redone_rear_3_4.png', side_profile: 'mazda_2_2024_white_redone_side_profile.png' },
  'mazda|3_sedan|2025':{ front_3_4: 'mazda_3_sedan_2025_white_front_3_4.png', rear_3_4: 'mazda_3_sedan_2025_white_rear_3_4.png', side_profile: 'mazda_3_sedan_2025_white_side_profile.png' },
  'mitsubishi|eclipse_cross|2024': { front_3_4: 'mitsubishi_eclipse_cross_2024_white_front_3_4.png', rear_3_4: 'mitsubishi_eclipse_cross_2024_white_rear_3_4.png', side_profile: 'mitsubishi_eclipse_cross_2024_white_side_profile.png' },
  'nissan|sentra|2025':{ front_3_4: 'nissan_sentra_2025_white_front_3_4.png', rear_3_4: 'nissan_sentra_2025_white_rear_3_4.png', side_profile: 'nissan_sentra_2025_white_side_profile.png' },
  'toyota|yaris|2025': { front_3_4: 'toyota_yaris_2025_white_corrected_front_3_4_front.png', rear_3_4: 'toyota_yaris_2025_white_no_plate_rear_3_4.png', side_profile: 'toyota_yaris_2025_white_corrected_side_profile.png' },
  'toyota|yaris_cross|2025': { front_3_4: 'toyota_yaris_cross_2025_white_front_3_4.png', rear_3_4: 'toyota_yaris_cross_2025_white_rear_3_4.png', side_profile: 'toyota_yaris_cross_2025_white_side_profile.png' },
};

// DB make/model → file key mapping
const makeAliases = {
  'bmw': 'bmw', 'chery': 'chery', 'chevrolet': 'chevrolet',
  'citroen': 'citroen', 'citroën': 'citroen', 'ford': 'ford',
  'hyundai': 'hyundai', 'kia': 'kia', 'mazda': 'mazda',
  'mitsubishi': 'mitsubishi', 'nissan': 'nissan', 'toyota': 'toyota',
};
const modelAliases = {
  '1 series': '1_series', '5 series': '5_series', 'x1': 'x1',
  'fx': 'fx', 'tiggo 4': 'tiggo_4', 'tiggo 7': 'tiggo_7', 'tiggo 8': 'tiggo_8',
  'traverse': 'traverse', 'c4': 'c4', 'berlingo': 'berlingo',
  'transit': 'transit', 'i10': 'i10',
  'carnival': 'carnival', 'picanto': 'picanto', 'sorento': 'sorento',
  'sportage': 'sportage', 'stonic': 'stonic',
  '2': '2', 'mazda 2': '2', '3': '3_sedan', 'mazda 3': '3_sedan', '3 sedan': '3_sedan',
  'eclipse cross': 'eclipse_cross', 'sentra': 'sentra',
  'yaris': 'yaris', 'yaris cross': 'yaris_cross',
};

// Fetch all vehicles
const { data: vehicles, error: dbError } = await supabase
  .from('vehicles')
  .select('id, make, model, year, image_urls');

if (dbError) { console.error('DB error:', dbError.message); process.exit(1); }

console.log(`Fetched ${vehicles.length} vehicles\n`);

const noMatch = [];
let updateCount = 0;

for (const v of vehicles) {
  const fileMake = makeAliases[v.make.toLowerCase()];
  if (!fileMake) { noMatch.push(`${v.make} ${v.model} ${v.year} — make not mapped`); continue; }

  const fileModel = modelAliases[v.model.toLowerCase()];
  if (!fileModel) { noMatch.push(`${v.make} ${v.model} ${v.year} — model not mapped`); continue; }

  // Try exact year match first, then any year for this make/model
  let angles = vehicleAngleMap[`${fileMake}|${fileModel}|${v.year}`];
  if (!angles) {
    const key = Object.keys(vehicleAngleMap).find(k => k.startsWith(`${fileMake}|${fileModel}|`));
    if (key) angles = vehicleAngleMap[key];
  }

  if (!angles) { noMatch.push(`${v.make} ${v.model} ${v.year} — no angle images`); continue; }

  const existing = (v.image_urls && v.image_urls.length > 0) ? v.image_urls[0] : null;
  if (!existing) { noMatch.push(`${v.make} ${v.model} ${v.year} — no existing image`); continue; }

  const newUrls = [
    existing,
    `${STORAGE_BASE}${angles.front_3_4}`,
    `${STORAGE_BASE}${angles.rear_3_4}`,
    `${STORAGE_BASE}${angles.side_profile}`,
  ];

  const { error } = await supabase.from('vehicles').update({ image_urls: newUrls }).eq('id', v.id);
  if (error) {
    console.error(`  ERROR ${v.make} ${v.model} ${v.year}:`, error.message);
  } else {
    console.log(`  ✓ ${v.make} ${v.model} ${v.year} → 4 images`);
    updateCount++;
  }
}

console.log(`\nUpdated: ${updateCount} vehicles`);
if (noMatch.length) {
  console.log(`No angle images for ${noMatch.length} vehicles:`);
  noMatch.forEach(m => console.log('  -', m));
}
