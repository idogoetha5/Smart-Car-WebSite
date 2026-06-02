import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars. Run: source .env.local && node scripts/update-prices.mjs');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const updates = [
  { categories: ['ECONOMY'],                          pricePerDay: 250,  pricePerMonth: 2800 },
  { categories: ['COMPACT', 'SEDAN', 'ELECTRIC'],     pricePerDay: 350,  pricePerMonth: 3500 },
  { categories: ['SUV', 'LUXURY', 'VAN', 'CONVERTIBLE'], pricePerDay: 500, pricePerMonth: 7500 },
];

for (const { categories, pricePerDay, pricePerMonth } of updates) {
  const { error, count } = await sb
    .from('vehicles')
    .update({ price_per_day: pricePerDay, price_per_month: pricePerMonth })
    .in('category', categories)
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error(`Error updating ${categories.join(',')}:`, error.message);
  } else {
    console.log(`Updated ${count} vehicles in [${categories.join(', ')}] → ₪${pricePerDay}/day, ₪${pricePerMonth}/month`);
  }
}

console.log('Done.');
