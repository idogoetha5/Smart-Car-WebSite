import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://iovpoxmdsgsstaduggvb.supabase.co';
const SERVICE_ROLE_KEY = 'process.env.SUPABASE_SERVICE_ROLE_KEY';
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/vehicles/`;
const IMAGES_DIR = '/Users/idogoetha/smartcar/public/images/vehicles';
const BUCKET = 'vehicles';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Vehicles with extra photos available locally
const vehicleExtras = {
  'Mercedes': {
    modelContains: 'C180',
    // Use the best quality images: the numbered jpegs
    files: [
      'mercedes-c180-1.jpeg',
      'mercedes-c180-2.jpeg',
      'mercedes-c180-3.jpeg',
      'mercedes-c180-4.jpeg',
    ],
  },
  'Kia-Seltos': {
    make: 'Kia',
    modelContains: 'Seltos',
    files: [
      'kia-seltos-1.jpeg',
      'kia-seltos-2.jpeg',
      'kia-seltos-3.jpeg',
      'kia-seltos-4.jpeg',
    ],
  },
  'Nissan-Juke': {
    make: 'Nissan',
    modelContains: 'Juke',
    files: [
      'nissan-juke-1.webp',
      'nissan-juke-2.webp',
      'nissan-juke-3.webp',
    ],
  },
};

// Upload files to Supabase Storage
async function uploadFile(filename) {
  const filePath = path.join(IMAGES_DIR, filename);
  if (!fs.existsSync(filePath)) { console.log(`  MISSING: ${filename}`); return false; }
  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const mimeMap = { '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.avif': 'image/avif' };
  const contentType = mimeMap[ext] || 'image/jpeg';
  const { error } = await supabase.storage.from(BUCKET).upload(filename, fileBuffer, { contentType, upsert: true });
  if (error) { console.error(`  ERROR uploading ${filename}:`, error.message); return false; }
  return true;
}

// Fetch all vehicles with only 1 image
const { data: vehicles, error } = await supabase.from('vehicles').select('id, make, model, year, image_urls');
if (error) { console.error(error.message); process.exit(1); }

for (const [key, config] of Object.entries(vehicleExtras)) {
  const matchingVehicles = vehicles.filter(v => {
    const makeMatch = config.make ? v.make.toLowerCase() === config.make.toLowerCase() : v.make.toLowerCase().includes(key.split('-')[0].toLowerCase());
    const modelMatch = v.model.toLowerCase().includes(config.modelContains.toLowerCase());
    return makeMatch && modelMatch;
  });

  console.log(`\n${key}: ${matchingVehicles.length} DB records found`);
  if (matchingVehicles.length === 0) { console.log('  → No matching vehicles in DB'); continue; }

  // Upload files
  const uploadedUrls = [];
  for (const filename of config.files) {
    process.stdout.write(`  Uploading ${filename}... `);
    const ok = await uploadFile(filename);
    if (ok) { console.log('OK'); uploadedUrls.push(`${STORAGE_BASE}${filename}`); }
  }
  console.log(`  Uploaded ${uploadedUrls.length} files`);

  if (uploadedUrls.length === 0) { console.log('  → Skipping DB update'); continue; }

  // Update each matching vehicle
  for (const v of matchingVehicles) {
    const currentFirst = v.image_urls?.[0] ?? null;
    // Build array: current main + uploaded extras (up to 4 total)
    const newUrls = currentFirst
      ? [currentFirst, ...uploadedUrls.slice(0, 3)]
      : uploadedUrls.slice(0, 4);

    const { error: upErr } = await supabase.from('vehicles').update({ image_urls: newUrls }).eq('id', v.id);
    if (upErr) console.error(`  ERROR ${v.make} ${v.model} ${v.year}:`, upErr.message);
    else console.log(`  ✓ ${v.make} ${v.model} ${v.year} → ${newUrls.length} images`);
  }
}

// Print summary of vehicles still with 1 image
const { data: updated } = await supabase.from('vehicles').select('make, model, year, image_urls');
const stillOne = [...new Set(
  updated.filter(v => (v.image_urls?.length ?? 0) <= 1)
         .map(v => `${v.make} ${v.model} ${v.year}`)
)].sort();
console.log(`\n--- Vehicles still with only 1 image (${stillOne.length} unique types) ---`);
stillOne.forEach(s => console.log(' -', s));
