import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';

const sb = createClient(
  'https://iovpoxmdsgsstaduggvb.supabase.co',
  'process.env.SUPABASE_SERVICE_ROLE_KEY'
);

const updates = [
  // Economy
  { make: 'KIA', model: 'Picanto', images: ['/images/vehicles/kia_picanto_2024_white_front_3_4.png','/images/vehicles/kia_picanto_2024_white_rear_3_4.png','/images/vehicles/kia_picanto_2024_white_side_profile.png','/images/vehicles/kia_picanto_2024_white_front_3_4_doors_open.png'] },
  { make: 'Toyota', model: 'Aygo X', images: ['/images/vehicles/33_2024_toyota_aygo_x.png'] },
  { make: 'Dacia', model: 'Sandero', images: ['/images/vehicles/04_2024_dacia_sandero.png'] },
  { make: 'Renault', model: 'Clio', images: ['/images/vehicles/20_2024_renault_clio.png'] },
  { make: 'Nissan', model: 'Micra', images: ['/images/vehicles/21_2023_nissan_micra.png'] },
  { make: 'Mitsubishi', model: 'Space Star', images: ['/images/vehicles/12_2024_mitsubishi_space_star.png'] },
  { make: 'Peugeot', model: '301', images: ['/images/vehicles/19_2023_peugeot_301.png'] },
  { make: 'Mazda', model: '2', images: ['/images/vehicles/mazda_2_2024_white_redone_front_3_4.png','/images/vehicles/mazda_2_2024_white_redone_rear_3_4.png','/images/vehicles/mazda_2_2024_white_redone_side_profile.png','/images/vehicles/mazda_2_2024_white_redone_front_3_4_doors_open.png'] },
  // Compact
  { make: 'Toyota', model: 'Yaris', images: ['/images/vehicles/toyota_yaris_2025_white_corrected_front_3_4_front.png','/images/vehicles/toyota_yaris_2025_white_no_plate_rear_3_4.png','/images/vehicles/toyota_yaris_2025_white_corrected_side_profile.png','/images/vehicles/toyota_yaris_2025_white_corrected_front_3_4_doors_open.png'] },
  { make: 'KIA', model: 'Rio', images: ['/images/vehicles/15_2024_kia_rio.png'] },
  { make: 'KIA', model: 'Stonic', images: ['/images/vehicles/kia_stonic_2024_white_front_3_4.png','/images/vehicles/kia_stonic_2024_white_rear_3_4.png','/images/vehicles/kia_stonic_2024_white_side_profile.png','/images/vehicles/kia_stonic_2024_white_front_3_4_doors_open.png'] },
  { make: 'Nissan', model: 'Sentra', images: ['/images/vehicles/nissan_sentra_2025_white_front_3_4.png','/images/vehicles/nissan_sentra_2025_white_rear_3_4.png','/images/vehicles/nissan_sentra_2025_white_side_profile.png','/images/vehicles/nissan_sentra_2025_white_front_3_4_doors_open.png'] },
  { make: 'Hyundai', model: 'i20', images: ['/images/vehicles/08_2024_hyundai_i20.png'] },
  { make: 'Honda', model: 'City', images: ['/images/vehicles/02_2024_honda_city.png'] },
  { make: 'Hyundai', model: 'Bayon', images: ['/images/vehicles/01_2024_hyundai_bayon.png'] },
  { make: 'KIA', model: 'XCeed', images: ['/images/vehicles/10_2024_kia_xceed.png'] },
  { make: 'Mazda', model: '3', images: ['/images/vehicles/mazda_3_sedan_2025_white_front_3_4.png','/images/vehicles/mazda_3_sedan_2025_white_rear_3_4.png','/images/vehicles/mazda_3_sedan_2025_white_side_profile.png','/images/vehicles/mazda_3_sedan_2025_white_front_3_4_doors_open.png'] },
  { make: 'Chery', model: 'FX', images: ['/images/vehicles/chery_fx_2025_white_corrected_front_3_4.png','/images/vehicles/chery_fx_2025_white_corrected_rear_3_4.png','/images/vehicles/chery_fx_2025_white_corrected_side_profile.png','/images/vehicles/chery_fx_2025_white_corrected_front_3_4_doors_open.png'] },
  { make: 'KIA', model: 'Ceed', images: ['/images/vehicles/13_2024_kia_ceed.png'] },
  { make: 'Seat', model: 'Arona', images: ['/images/vehicles/25_2024_seat_arona.png'] },
  { make: 'Chery', model: 'Arrizo', images: ['/images/vehicles/05_2025_chery_arrizo.png'] },
  { make: 'Mitsubishi', model: 'Eclipse Cross', images: ['/images/vehicles/mitsubishi_eclipse_cross_2024_white_front_3_4.png','/images/vehicles/mitsubishi_eclipse_cross_2024_white_rear_3_4.png','/images/vehicles/mitsubishi_eclipse_cross_2024_white_side_profile.png','/images/vehicles/mitsubishi_eclipse_cross_2024_white_front_3_4_doors_open.png'] },
  { make: 'Seres', model: '3', images: ['/images/vehicles/29_2024_seres_3.png'] },
  // Sedan
  { make: 'Toyota', model: 'Corolla', images: ['/images/vehicles/31_2024_toyota_corolla.png'] },
  // SUV
  { make: 'Nissan', model: 'Qashqai', images: ['/images/vehicles/23_2024_nissan_qashqai.png'] },
  { make: 'KIA', model: 'Sportage', images: ['/images/vehicles/kia_sportage_2025_white_front_3_4.png','/images/vehicles/kia_sportage_2025_white_rear_3_4.png','/images/vehicles/kia_sportage_2025_white_side_profile.png','/images/vehicles/kia_sportage_2025_white_front_3_4_doors_open.png'] },
  { make: 'KIA', model: 'Seltos', images: ['/images/vehicles/seltos-1.png','/images/vehicles/seltos-2.png','/images/vehicles/seltos-extra-1.png','/images/vehicles/seltos-extra-2.png'] },
  { make: 'Chery', model: 'Tiggo 7', images: ['/images/vehicles/chery_tiggo_7_2024_white_front_3_4.png','/images/vehicles/chery_tiggo_7_2024_white_rear_3_4.png','/images/vehicles/chery_tiggo_7_2024_white_side_profile.png','/images/vehicles/chery_tiggo_7_2024_white_front_3_4_doors_open.png'] },
  { make: 'Chery', model: 'Tiggo 8', images: ['/images/vehicles/chery_tiggo_8_2025_white_front_3_4.png','/images/vehicles/chery_tiggo_8_2025_white_rear_3_4.png','/images/vehicles/chery_tiggo_8_2025_white_side_profile.png','/images/vehicles/chery_tiggo_8_2025_white_front_3_4_doors_open.png'] },
  { make: 'Chery', model: 'Tiggo 4', images: ['/images/vehicles/chery_tiggo_4_2025_white_front_3_4.png','/images/vehicles/chery_tiggo_4_2025_white_rear_3_4.png','/images/vehicles/chery_tiggo_4_2025_white_side_profile.png','/images/vehicles/chery_tiggo_4_2025_white_front_3_4_doors_open.png'] },
  { make: 'Hyundai', model: 'Kona', images: ['/images/vehicles/17_2024_hyundai_kona.png'] },
  { make: 'KIA', model: 'Sorento', images: ['/images/vehicles/kia_sorento_2025_white_front_3_4.png','/images/vehicles/kia_sorento_2025_white_rear_3_4.png','/images/vehicles/kia_sorento_2025_white_side_profile.png','/images/vehicles/kia_sorento_2025_white_front_3_4_doors_open.png'] },
  { make: 'Nissan', model: 'Juke', images: ['/images/vehicles/nissan-juke-1.webp','/images/vehicles/nissan-juke-2.webp','/images/vehicles/nissan-juke-3.webp'] },
  { make: 'KIA', model: 'Niro', images: ['/images/vehicles/14_2024_kia_niro.png'] },
  { make: 'Peugeot', model: '2008', images: ['/images/vehicles/24_2024_peugeot_2008.png'] },
  { make: 'MG', model: 'ZS', images: ['/images/vehicles/11_2024_mg_zs.png'] },
  { make: 'Seat', model: 'Ateca', images: ['/images/vehicles/30_2024_seat_ateca.png'] },
  { make: 'Renault', model: 'Koleos', images: ['/images/vehicles/27_2024_renault_koleos.png'] },
  { make: 'Subaru', model: 'Crosstrek', images: ['/images/vehicles/22_2024_subaru_crosstrek.png'] },
  { make: 'Jaecoo', model: '7', images: ['/images/vehicles/16_2025_jaecoo_7.png'] },
  // Electric
  { make: 'Hyundai', model: 'Ioniq 5', images: ['/images/vehicles/18_2024_hyundai_ioniq.png'] },
  { make: 'Xpeng', model: 'G3', images: ['/images/vehicles/32_2024_xpeng_g3.png'] },
  // Luxury
  { make: 'BMW', model: '118i', images: ['/images/vehicles/bmw_1_series_2026_white_front_3_4.png','/images/vehicles/bmw_1_series_2026_white_rear_3_4.png','/images/vehicles/bmw_1_series_2026_white_side_profile.png','/images/vehicles/bmw_1_series_2026_white_front_3_4_doors_open.png'] },
  { make: 'BMW', model: '530e', images: ['/images/vehicles/bmw_5_series_2024_white_front_3_4.png','/images/vehicles/bmw_5_series_2024_white_rear_3_4.png','/images/vehicles/bmw_5_series_2024_white_side_profile.png','/images/vehicles/bmw_5_series_2024_white_front_3_4_doors_open.png'] },
  { make: 'BMW', model: 'X1', images: ['/images/vehicles/bmw_x1_2025_black_front_3_4.png','/images/vehicles/bmw_x1_2025_black_rear_3_4.png','/images/vehicles/bmw_x1_2025_black_side_profile.png','/images/vehicles/bmw_x1_2025_black_front_3_4_doors_open.png'] },
  { make: 'Mercedes-Benz', model: 'C 180', images: ['/images/vehicles/mercedes-c180.jpg'] },
  { make: 'Audi', model: 'A3', images: ['/images/vehicles/07_2025_audi_a3.png'] },
  { make: 'Hyundai', model: 'Elantra', images: ['/images/vehicles/09_2024_hyundai_elantra.png'] },
  { make: 'Subaru', model: 'XV', images: ['/images/vehicles/28_2023_subaru_xv.png'] },
  // Van
  { make: 'Chevrolet', model: 'Traverse', images: ['/images/vehicles/chevrolet_traverse_2025_white_front_3_4.png','/images/vehicles/chevrolet_traverse_2025_white_rear_3_4.png','/images/vehicles/chevrolet_traverse_2025_white_side_profile.png','/images/vehicles/chevrolet_traverse_2025_white_front_3_4_doors_open.png'] },
  { make: 'Chrysler', model: 'Grand Voyager', images: ['/images/vehicles/06_2023_chrysler_grand_voyager.png'] },
  { make: 'KIA', model: 'Carnival', images: ['/images/vehicles/kia_carnival_2024_white_front_3_4.png','/images/vehicles/kia_carnival_2024_white_rear_3_4.png','/images/vehicles/kia_carnival_2024_white_side_profile.png','/images/vehicles/kia_carnival_2024_white_front_3_4_doors_open.png'] },
  { make: 'Fiat', model: 'Doblo', images: ['/images/vehicles/03_2024_fiat_doblo.png'] },
  { make: 'Renault', model: 'Kangoo', images: ['/images/vehicles/26_2024_renault_kangoo.png'] },
];

let successCount = 0;
let failCount = 0;

for (const { make, model, images } of updates) {
  const { error, count } = await sb
    .from('vehicles')
    .update({ image_urls: images })
    .eq('make', make)
    .eq('model', model);

  if (error) {
    console.error(`❌ ${make} ${model}: ${error.message}`);
    failCount++;
  } else {
    console.log(`✅ ${make} ${model} — ${images.length} image(s)`);
    successCount++;
  }
}

console.log(`\nDone: ${successCount} updated, ${failCount} failed`);

// Show any still missing images
const { data } = await sb.from('vehicles').select('make, model, image_urls');
const missing = (data ?? []).filter(v => !v.image_urls || v.image_urls.length === 0);
const uniqueMissing = [...new Map(missing.map(v => [`${v.make}|${v.model}`, v])).values()];
if (uniqueMissing.length > 0) {
  console.log('\nStill missing images:');
  uniqueMissing.forEach(v => console.log(`  - ${v.make} ${v.model}`));
} else {
  console.log('\nAll vehicles have images! 🎉');
}
