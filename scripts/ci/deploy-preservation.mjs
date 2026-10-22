import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const fail = message => { throw new Error(`DEPLOYMENT BLOCKED: ${message}`); };
try {
  if (!process.argv.includes('--build')) {
  execFileSync('git', ['rev-parse', '--show-toplevel'], { stdio: 'pipe' });
  execFileSync('git', ['fetch', 'origin', 'clean-main'], { stdio: 'pipe' });
  execFileSync('git', ['merge-base', '--is-ancestor', 'origin/clean-main', 'HEAD'], { stdio: 'pipe' });
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' });
  if (dirty.trim()) fail('Tracked release files are uncommitted. Preserve and commit the intended changes before publishing.');
  }
  const required = [
    'src/components/admin/SearchConsolePanel.tsx',
    'src/components/admin/SearchPerformanceExplorer.tsx',
    'src/app/[locale]/admin/(protected)/search-performance/page.tsx',
    'src/lib/search-console.ts',
    'src/components/admin/VehicleImageUpload.tsx',
    'src/app/api/admin/vehicle-image/route.ts',
  ];
  for (const path of required) if (!existsSync(path)) fail(`Missing preserved feature: ${path}`);
  for (const [path, text] of [
    ['src/app/[locale]/admin/(protected)/page.tsx', '<SearchConsolePanel'],
    ['src/components/catalog/VehicleCard.tsx', 'displayPricePerDay'],
    ['src/app/api/bookings/route.ts', 'minimum_daily_price'],
    ['src/components/booking/BookingForm.tsx', 'rentalDurationDiscount'],
  ]) if (!readFileSync(path, 'utf8').includes(text)) fail(`Preservation marker missing in ${path}: ${text}`);
  const response = await fetch('https://www.smartcar.co.il/api/vehicles', { signal: AbortSignal.timeout(20000) });
  if (!response.ok) fail(`Could not check live inventory (${response.status}); do not publish without this check.`);
  const inventory = await response.json();
  if (!Array.isArray(inventory.data) || inventory.data.length === 0) fail('Live inventory response is invalid.');
  const localAssets = new Set();
  for (const vehicle of inventory.data) {
    for (const value of vehicle.imageUrls ?? []) {
      const url = new URL(value, 'https://www.smartcar.co.il');
      if (['www.smartcar.co.il', 'smartcar.co.il'].includes(url.hostname) && url.pathname.startsWith('/images/vehicle-gallery/')) {
        localAssets.add(`public${decodeURIComponent(url.pathname)}`);
      }
    }
  }
  if (localAssets.size === 0) fail('No expected gallery assets found; check response rather than silently skipping.');
  for (const path of localAssets) if (!existsSync(path) || readFileSync(path).length === 0) fail(`Published gallery asset missing from release: ${path}`);
  console.log(`Preservation preflight passed: ${inventory.data.length} vehicles, ${localAssets.size} published gallery files, Search Console and X2 pricing preserved.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
