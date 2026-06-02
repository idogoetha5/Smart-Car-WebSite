import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://iovpoxmdsgsstaduggvb.supabase.co';
const SERVICE_ROLE_KEY = 'process.env.SUPABASE_SERVICE_ROLE_KEY';
const STORAGE_BASE = `${SUPABASE_URL}/storage/v1/object/public/vehicles/`;
const SOURCE_DIR = '/Users/idogoetha/Downloads/תמונות רכבים 2';
const BUCKET = 'vehicles';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Parse filename like "Renault_Clio_2024_front_3-4.png" → { make, model, year, angleType }
function parseCapFile(filename) {
  const ext = path.extname(filename);
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext.toLowerCase())) return null;

  const base = filename.slice(0, -ext.length);
  // Angle patterns to detect
  const anglePatterns = [
    { suffix: '_front_3-4',        type: 'front' },
    { suffix: '_front_doors_open', type: 'doors_open' },
    { suffix: '_rear_3-4',         type: 'rear' },
    { suffix: '_side_profile',     type: 'side' },
    { suffix: '_side_doors_open',  type: 'side_open' },
  ];

  let angleType = null, vehiclePart = null;
  for (const ap of anglePatterns) {
    if (base.endsWith(ap.suffix)) {
      angleType = ap.type;
      vehiclePart = base.slice(0, -ap.suffix.length);
      break;
    }
  }
  if (!angleType) return null;

  // vehiclePart = "Renault_Clio_2024" or "Hyundai_i20_2024"
  const parts = vehiclePart.split('_');
  const yearIdx = parts.findIndex(p => /^\d{4}$/.test(p));
  if (yearIdx === -1) return null;

  const make = parts.slice(0, 1).join(' ');
  const model = parts.slice(1, yearIdx).join(' ');
  const year = parseInt(parts[yearIdx]);

  return { make, model, year, angleType, filename };
}

// Normalize for matching
const normalize = s => s.toLowerCase().replace(/\s+/g, ' ').trim();

// Group all angle files by vehicle
const allFiles = fs.readdirSync(SOURCE_DIR);
const vehicleMap = {}; // `make|model|year` → { front, rear, side, doors_open, side_open }

for (const f of allFiles) {
  const parsed = parseCapFile(f);
  if (!parsed) continue;
  const key = `${normalize(parsed.make)}|${normalize(parsed.model)}|${parsed.year}`;
  if (!vehicleMap[key]) vehicleMap[key] = { make: parsed.make, model: parsed.model, year: parsed.year };
  vehicleMap[key][parsed.angleType] = parsed.filename;
}

console.log(`Found angle sets for ${Object.keys(vehicleMap).length} vehicles in source dir\n`);

// Fetch all DB vehicles with 1 image (need updating)
const { data: vehicles, error } = await supabase.from('vehicles').select('id, make, model, year, image_urls');
if (error) { console.error(error.message); process.exit(1); }

const needsUpdate = vehicles.filter(v => (v.image_urls?.length ?? 0) <= 1);
console.log(`Vehicles needing update: ${needsUpdate.length}\n`);

// Upload a file from source dir
async function upload(filename) {
  const filePath = path.join(SOURCE_DIR, filename);
  if (!fs.existsSync(filePath)) { console.error(`  MISSING: ${filePath}`); return null; }
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
  const { error } = await supabase.storage.from(BUCKET).upload(filename, buf, { contentType: mime[ext] || 'image/png', upsert: true });
  if (error) { console.error(`  ERROR uploading ${filename}:`, error.message); return null; }
  return `${STORAGE_BASE}${filename}`;
}

let updated = 0, skipped = 0;
const noMatch = [];

for (const v of needsUpdate) {
  const vMake = normalize(v.make);
  const vModel = normalize(v.model);
  const vYear = v.year;

  // Try exact match first
  let key = `${vMake}|${vModel}|${vYear}`;
  let angles = vehicleMap[key];

  // If no match, try fuzzy (year ±1, or model contains)
  if (!angles) {
    const possibleKey = Object.keys(vehicleMap).find(k => {
      const [km, kmo, ky] = k.split('|');
      return km === vMake && (kmo.includes(vModel) || vModel.includes(kmo));
    });
    if (possibleKey) angles = vehicleMap[possibleKey];
  }

  if (!angles) {
    noMatch.push(`${v.make} ${v.model} ${v.year}`);
    skipped++;
    continue;
  }

  const existing = v.image_urls?.[0] ?? null;
  if (!existing) { noMatch.push(`${v.make} ${v.model} ${v.year} (no existing image)`); skipped++; continue; }

  // Pick 3 angles: prefer front/doors_open, rear, side/side_open
  const img2 = angles.front || angles.doors_open;
  const img3 = angles.rear;
  const img4 = angles.side || angles.side_open;

  if (!img2 && !img3 && !img4) { noMatch.push(`${v.make} ${v.model} ${v.year} (no angle files parsed)`); skipped++; continue; }

  // Upload needed files
  const urls = [existing];
  if (img2) { const u = await upload(img2); if (u) urls.push(u); }
  if (img3) { const u = await upload(img3); if (u) urls.push(u); }
  if (img4) { const u = await upload(img4); if (u) urls.push(u); }

  if (urls.length < 2) { console.log(`  WARN: ${v.make} ${v.model} ${v.year} — no urls uploaded`); skipped++; continue; }

  const { error: upErr } = await supabase.from('vehicles').update({ image_urls: urls }).eq('id', v.id);
  if (upErr) { console.error(`  ERROR updating ${v.make} ${v.model} ${v.year}:`, upErr.message); skipped++; }
  else { console.log(`  ✓ ${v.make} ${v.model} ${v.year} → ${urls.length} images`); updated++; }
}

console.log(`\nUpdated: ${updated} | Skipped: ${skipped}`);
if (noMatch.length) {
  console.log('\nNo match:');
  [...new Set(noMatch)].forEach(m => console.log(' -', m));
}
