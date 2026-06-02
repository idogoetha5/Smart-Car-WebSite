import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://iovpoxmdsgsstaduggvb.supabase.co';
const SERVICE_ROLE_KEY = 'process.env.SUPABASE_SERVICE_ROLE_KEY';
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/vehicles/`;
const IMAGES_DIR = '/Users/idogoetha/smartcar/public/images/vehicles';
const BUCKET = 'vehicles';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Get all new angle image files
const allFiles = fs.readdirSync(IMAGES_DIR);
const angleFiles = allFiles.filter(f =>
  f.endsWith('.png') && (
    f.includes('front_3_4') ||
    f.includes('rear_3_4') ||
    f.includes('side_profile')
  )
);

// Prefer "redone" and "corrected" variants, deduplicate by vehicle+angle
// For each vehicle key + angle, pick the best file
function getAngleKey(filename) {
  // Extract angle from filename
  if (filename.includes('front_3_4_doors_open')) return 'doors_open';
  if (filename.includes('front_3_4')) return 'front_3_4';
  if (filename.includes('rear_3_4')) return 'rear_3_4';
  if (filename.includes('side_profile')) return 'side_profile';
  return null;
}

// Map filename → vehicle key
// Pattern: {make}_{model}_{year}_{color}[_corrected|_redone]_{angle}.png
// We need to extract make, model, year to match DB records
function parseFilename(filename) {
  const name = filename.replace('.png', '');
  const angle = getAngleKey(filename);
  if (!angle) return null;

  // Remove the angle suffix (including doors_open variant)
  let base = name;
  if (base.endsWith('_front_3_4_doors_open')) base = base.slice(0, -'_front_3_4_doors_open'.length);
  else if (base.endsWith('_front_3_4_front')) base = base.slice(0, -'_front_3_4_front'.length); // toyota variant
  else if (base.endsWith('_front_3_4')) base = base.slice(0, -'_front_3_4'.length);
  else if (base.endsWith('_rear_3_4')) base = base.slice(0, -'_rear_3_4'.length);
  else if (base.endsWith('_side_profile')) base = base.slice(0, -'_side_profile'.length);

  // Remove color qualifiers (last segment before angle was color)
  // base is now like: bmw_1_series_2026_white or chery_fx_2025_grey_corrected
  // Remove _corrected or _redone or _no_plate suffixes
  base = base.replace(/_corrected$/, '').replace(/_redone$/, '').replace(/_no_plate$/, '');

  // Now split by _ to find year (4-digit number)
  const parts = base.split('_');
  const yearIdx = parts.findIndex(p => /^\d{4}$/.test(p));
  if (yearIdx === -1) return null;

  const make = parts.slice(0, 1).join('_'); // first segment is always make
  const model = parts.slice(1, yearIdx).join('_');
  const year = parseInt(parts[yearIdx]);

  return { make, model, year, angle, filename };
}

// Build map: `${make}|${model}|${year}` → { front_3_4, rear_3_4, side_profile }
const vehicleAngleMap = {};

for (const f of angleFiles) {
  const parsed = parseFilename(f);
  if (!parsed) continue;
  const { make, model, year, angle, filename } = parsed;
  const key = `${make}|${model}|${year}`;
  if (!vehicleAngleMap[key]) vehicleAngleMap[key] = {};

  // For duplicates (redone/corrected), prefer redone/corrected versions
  const existing = vehicleAngleMap[key][angle];
  if (!existing || filename.includes('redone') || filename.includes('corrected')) {
    vehicleAngleMap[key][angle] = filename;
  }
}

console.log('Parsed vehicle angle map:');
for (const [key, angles] of Object.entries(vehicleAngleMap)) {
  console.log(`  ${key}:`, angles);
}

// Upload all angle files to Supabase Storage
async function uploadFile(filename) {
  const filePath = path.join(IMAGES_DIR, filename);
  const fileBuffer = fs.readFileSync(filePath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, fileBuffer, {
      contentType: 'image/png',
      upsert: true,
    });
  if (error) {
    console.error(`  ERROR uploading ${filename}:`, error.message);
    return false;
  }
  return true;
}

// Get all unique filenames to upload
const filesToUpload = new Set();
for (const angles of Object.values(vehicleAngleMap)) {
  for (const f of Object.values(angles)) {
    filesToUpload.add(f);
  }
}

console.log(`\nUploading ${filesToUpload.size} angle images to Supabase Storage...`);
let uploadCount = 0;
for (const filename of filesToUpload) {
  process.stdout.write(`  Uploading ${filename}... `);
  const ok = await uploadFile(filename);
  if (ok) { console.log('OK'); uploadCount++; }
}
console.log(`Uploaded ${uploadCount}/${filesToUpload.size} files.\n`);

// Fetch all vehicles from DB
const { data: vehicles, error: dbError } = await supabase
  .from('vehicles')
  .select('id, make, model, year, image_url, image_urls');

if (dbError) {
  console.error('DB error:', dbError.message);
  process.exit(1);
}

// Normalize make/model for matching
function normalize(s) {
  return s.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// Map DB make → file make key
const makeAliases = {
  'bmw': 'bmw',
  'chery': 'chery',
  'chevrolet': 'chevrolet',
  'citroen': 'citroen',
  'citroën': 'citroen',
  'ford': 'ford',
  'hyundai': 'hyundai',
  'kia': 'kia',
  'mazda': 'mazda',
  'mitsubishi': 'mitsubishi',
  'nissan': 'nissan',
  'toyota': 'toyota',
};

// Map DB model → file model key
const modelAliases = {
  '1 series': '1_series',
  '5 series': '5_series',
  'x1': 'x1',
  'fx': 'fx',
  'tiggo 4': 'tiggo_4',
  'tiggo 7': 'tiggo_7',
  'tiggo 8': 'tiggo_8',
  'traverse': 'traverse',
  'c4': 'c4',
  'berlingo': 'berlingo',
  'transit': 'transit',
  'i10': 'i10',
  'carnival': 'carnival',
  'picanto': 'picanto',
  'sorento': 'sorento',
  'sportage': 'sportage',
  'stonic': 'stonic',
  '2': '2',
  'mazda 2': '2',
  '3': '3_sedan',
  'mazda 3': '3_sedan',
  '3 sedan': '3_sedan',
  'eclipse cross': 'eclipse_cross',
  'sentra': 'sentra',
  'yaris': 'yaris',
  'yaris cross': 'yaris_cross',
};

const updates = [];
const noMatch = [];

for (const v of vehicles) {
  const fileMake = makeAliases[v.make.toLowerCase()];
  if (!fileMake) { noMatch.push(`${v.make} ${v.model} ${v.year} — make not in alias list`); continue; }

  const fileModel = modelAliases[v.model.toLowerCase()];
  if (!fileModel) { noMatch.push(`${v.make} ${v.model} ${v.year} — model not in alias list`); continue; }

  // Try to find by year first, then ignore year (year might differ slightly)
  let angles = vehicleAngleMap[`${fileMake}|${fileModel}|${v.year}`];

  if (!angles) {
    // Try any year for this make/model
    const possibleKeys = Object.keys(vehicleAngleMap).filter(k => k.startsWith(`${fileMake}|${fileModel}|`));
    if (possibleKeys.length > 0) {
      angles = vehicleAngleMap[possibleKeys[0]];
    }
  }

  if (!angles) { noMatch.push(`${v.make} ${v.model} ${v.year} — no angle images found`); continue; }

  // Build new image_urls array
  const existingFirst = (v.image_urls && v.image_urls.length > 0) ? v.image_urls[0] : v.image_url;
  const newUrls = [existingFirst];

  if (angles.front_3_4) newUrls.push(`${STORAGE_BASE}${angles.front_3_4}`);
  if (angles.rear_3_4) newUrls.push(`${STORAGE_BASE}${angles.rear_3_4}`);
  if (angles.side_profile) newUrls.push(`${STORAGE_BASE}${angles.side_profile}`);

  updates.push({ id: v.id, make: v.make, model: v.model, year: v.year, image_urls: newUrls });
}

console.log(`\nVehicles to update: ${updates.length}`);
console.log(`No match: ${noMatch.length}`);
if (noMatch.length) {
  console.log('No match details:');
  noMatch.forEach(m => console.log('  ', m));
}

// Apply DB updates
console.log('\nUpdating DB records...');
let updateCount = 0;
for (const u of updates) {
  const { error } = await supabase
    .from('vehicles')
    .update({ image_urls: u.image_urls })
    .eq('id', u.id);

  if (error) {
    console.error(`  ERROR ${u.make} ${u.model} ${u.year}:`, error.message);
  } else {
    console.log(`  Updated: ${u.make} ${u.model} ${u.year} → ${u.image_urls.length} images`);
    updateCount++;
  }
}

console.log(`\nDone! Updated ${updateCount} vehicles.`);
