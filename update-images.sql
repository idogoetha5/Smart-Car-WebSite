-- ============================================================
-- SmartCar – Update image_urls for all vehicles
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Economy ─────────────────────────────────────────────────
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/kia_picanto_2024_white_front_3_4.png','/images/vehicles/kia_picanto_2024_white_rear_3_4.png','/images/vehicles/kia_picanto_2024_white_side_profile.png','/images/vehicles/kia_picanto_2024_white_front_3_4_doors_open.png'] WHERE make = 'KIA' AND model = 'Picanto';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/33_2024_toyota_aygo_x.png'] WHERE make = 'Toyota' AND model = 'Aygo X';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/04_2024_dacia_sandero.png'] WHERE make = 'Dacia' AND model = 'Sandero';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/20_2024_renault_clio.png'] WHERE make = 'Renault' AND model = 'Clio';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/21_2023_nissan_micra.png'] WHERE make = 'Nissan' AND model = 'Micra';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/12_2024_mitsubishi_space_star.png'] WHERE make = 'Mitsubishi' AND model = 'Space Star';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/19_2023_peugeot_301.png'] WHERE make = 'Peugeot' AND model = '301';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/mazda_2_2024_white_redone_front_3_4.png','/images/vehicles/mazda_2_2024_white_redone_rear_3_4.png','/images/vehicles/mazda_2_2024_white_redone_side_profile.png','/images/vehicles/mazda_2_2024_white_redone_front_3_4_doors_open.png'] WHERE make = 'Mazda' AND model = '2';

-- ── Compact ──────────────────────────────────────────────────
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/toyota_yaris_2025_white_corrected_front_3_4_front.png','/images/vehicles/toyota_yaris_2025_white_no_plate_rear_3_4.png','/images/vehicles/toyota_yaris_2025_white_corrected_side_profile.png','/images/vehicles/toyota_yaris_2025_white_corrected_front_3_4_doors_open.png'] WHERE make = 'Toyota' AND model = 'Yaris';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/15_2024_kia_rio.png'] WHERE make = 'KIA' AND model = 'Rio';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/kia_stonic_2024_white_front_3_4.png','/images/vehicles/kia_stonic_2024_white_rear_3_4.png','/images/vehicles/kia_stonic_2024_white_side_profile.png','/images/vehicles/kia_stonic_2024_white_front_3_4_doors_open.png'] WHERE make = 'KIA' AND model = 'Stonic';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/nissan_sentra_2025_white_front_3_4.png','/images/vehicles/nissan_sentra_2025_white_rear_3_4.png','/images/vehicles/nissan_sentra_2025_white_side_profile.png','/images/vehicles/nissan_sentra_2025_white_front_3_4_doors_open.png'] WHERE make = 'Nissan' AND model = 'Sentra';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/08_2024_hyundai_i20.png'] WHERE make = 'Hyundai' AND model = 'i20';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/02_2024_honda_city.png'] WHERE make = 'Honda' AND model = 'City';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/01_2024_hyundai_bayon.png'] WHERE make = 'Hyundai' AND model = 'Bayon';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/10_2024_kia_xceed.png'] WHERE make = 'KIA' AND model = 'XCeed';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/mazda_3_sedan_2025_white_front_3_4.png','/images/vehicles/mazda_3_sedan_2025_white_rear_3_4.png','/images/vehicles/mazda_3_sedan_2025_white_side_profile.png','/images/vehicles/mazda_3_sedan_2025_white_front_3_4_doors_open.png'] WHERE make = 'Mazda' AND model = '3';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/chery_fx_2025_white_corrected_front_3_4.png','/images/vehicles/chery_fx_2025_white_corrected_rear_3_4.png','/images/vehicles/chery_fx_2025_white_corrected_side_profile.png','/images/vehicles/chery_fx_2025_white_corrected_front_3_4_doors_open.png'] WHERE make = 'Chery' AND model = 'FX';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/13_2024_kia_ceed.png'] WHERE make = 'KIA' AND model = 'Ceed';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/25_2024_seat_arona.png'] WHERE make = 'Seat' AND model = 'Arona';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/05_2025_chery_arrizo.png'] WHERE make = 'Chery' AND model = 'Arrizo';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/mitsubishi_eclipse_cross_2024_white_front_3_4.png','/images/vehicles/mitsubishi_eclipse_cross_2024_white_rear_3_4.png','/images/vehicles/mitsubishi_eclipse_cross_2024_white_side_profile.png','/images/vehicles/mitsubishi_eclipse_cross_2024_white_front_3_4_doors_open.png'] WHERE make = 'Mitsubishi' AND model = 'Eclipse Cross';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/29_2024_seres_3.png'] WHERE make = 'Seres' AND model = '3';

-- ── Sedan ────────────────────────────────────────────────────
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/31_2024_toyota_corolla.png'] WHERE make = 'Toyota' AND model = 'Corolla';

-- ── SUV ──────────────────────────────────────────────────────
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/23_2024_nissan_qashqai.png'] WHERE make = 'Nissan' AND model = 'Qashqai';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/kia_sportage_2025_white_front_3_4.png','/images/vehicles/kia_sportage_2025_white_rear_3_4.png','/images/vehicles/kia_sportage_2025_white_side_profile.png','/images/vehicles/kia_sportage_2025_white_front_3_4_doors_open.png'] WHERE make = 'KIA' AND model = 'Sportage';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/seltos-1.png','/images/vehicles/seltos-2.png','/images/vehicles/seltos-extra-1.png','/images/vehicles/seltos-extra-2.png'] WHERE make = 'KIA' AND model = 'Seltos';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/chery_tiggo_7_2024_white_front_3_4.png','/images/vehicles/chery_tiggo_7_2024_white_rear_3_4.png','/images/vehicles/chery_tiggo_7_2024_white_side_profile.png','/images/vehicles/chery_tiggo_7_2024_white_front_3_4_doors_open.png'] WHERE make = 'Chery' AND model = 'Tiggo 7';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/chery_tiggo_8_2025_white_front_3_4.png','/images/vehicles/chery_tiggo_8_2025_white_rear_3_4.png','/images/vehicles/chery_tiggo_8_2025_white_side_profile.png','/images/vehicles/chery_tiggo_8_2025_white_front_3_4_doors_open.png'] WHERE make = 'Chery' AND model = 'Tiggo 8';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/chery_tiggo_4_2025_white_front_3_4.png','/images/vehicles/chery_tiggo_4_2025_white_rear_3_4.png','/images/vehicles/chery_tiggo_4_2025_white_side_profile.png','/images/vehicles/chery_tiggo_4_2025_white_front_3_4_doors_open.png'] WHERE make = 'Chery' AND model = 'Tiggo 4';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/17_2024_hyundai_kona.png'] WHERE make = 'Hyundai' AND model = 'Kona';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/kia_sorento_2025_white_front_3_4.png','/images/vehicles/kia_sorento_2025_white_rear_3_4.png','/images/vehicles/kia_sorento_2025_white_side_profile.png','/images/vehicles/kia_sorento_2025_white_front_3_4_doors_open.png'] WHERE make = 'KIA' AND model = 'Sorento';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/14_2024_kia_niro.png'] WHERE make = 'KIA' AND model = 'Niro';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/24_2024_peugeot_2008.png'] WHERE make = 'Peugeot' AND model = '2008';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/11_2024_mg_zs.png'] WHERE make = 'MG' AND model = 'ZS';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/30_2024_seat_ateca.png'] WHERE make = 'Seat' AND model = 'Ateca';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/27_2024_renault_koleos.png'] WHERE make = 'Renault' AND model = 'Koleos';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/22_2024_subaru_crosstrek.png'] WHERE make = 'Subaru' AND model = 'Crosstrek';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/16_2025_jaecoo_7.png'] WHERE make = 'Jaecoo' AND model = '7';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/nissan-juke-1.webp','/images/vehicles/nissan-juke-2.webp','/images/vehicles/nissan-juke-3.webp'] WHERE make = 'Nissan' AND model = 'Juke';

-- ── Electric ─────────────────────────────────────────────────
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/18_2024_hyundai_ioniq.png'] WHERE make = 'Hyundai' AND model = 'Ioniq 5';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/32_2024_xpeng_g3.png'] WHERE make = 'Xpeng' AND model = 'G3';

-- ── Luxury ───────────────────────────────────────────────────
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/bmw_1_series_2026_white_front_3_4.png','/images/vehicles/bmw_1_series_2026_white_rear_3_4.png','/images/vehicles/bmw_1_series_2026_white_side_profile.png','/images/vehicles/bmw_1_series_2026_white_front_3_4_doors_open.png'] WHERE make = 'BMW' AND model = '118i';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/bmw_5_series_2024_white_front_3_4.png','/images/vehicles/bmw_5_series_2024_white_rear_3_4.png','/images/vehicles/bmw_5_series_2024_white_side_profile.png','/images/vehicles/bmw_5_series_2024_white_front_3_4_doors_open.png'] WHERE make = 'BMW' AND model = '530e';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/bmw_x1_2025_black_front_3_4.png','/images/vehicles/bmw_x1_2025_black_rear_3_4.png','/images/vehicles/bmw_x1_2025_black_side_profile.png','/images/vehicles/bmw_x1_2025_black_front_3_4_doors_open.png'] WHERE make = 'BMW' AND model = 'X1';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/mercedes-c180.jpg'] WHERE make = 'Mercedes-Benz' AND model = 'C 180';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/07_2025_audi_a3.png'] WHERE make = 'Audi' AND model = 'A3';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/09_2024_hyundai_elantra.png'] WHERE make = 'Hyundai' AND model = 'Elantra';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/28_2023_subaru_xv.png'] WHERE make = 'Subaru' AND model = 'XV';

-- ── Van ──────────────────────────────────────────────────────
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/chevrolet_traverse_2025_white_front_3_4.png','/images/vehicles/chevrolet_traverse_2025_white_rear_3_4.png','/images/vehicles/chevrolet_traverse_2025_white_side_profile.png','/images/vehicles/chevrolet_traverse_2025_white_front_3_4_doors_open.png'] WHERE make = 'Chevrolet' AND model = 'Traverse';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/06_2023_chrysler_grand_voyager.png'] WHERE make = 'Chrysler' AND model = 'Grand Voyager';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/kia_carnival_2024_white_front_3_4.png','/images/vehicles/kia_carnival_2024_white_rear_3_4.png','/images/vehicles/kia_carnival_2024_white_side_profile.png','/images/vehicles/kia_carnival_2024_white_front_3_4_doors_open.png'] WHERE make = 'KIA' AND model = 'Carnival';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/03_2024_fiat_doblo.png'] WHERE make = 'Fiat' AND model = 'Doblo';
UPDATE vehicles SET image_urls = ARRAY['/images/vehicles/26_2024_renault_kangoo.png'] WHERE make = 'Renault' AND model = 'Kangoo';

-- Verify results
SELECT make, model, array_length(image_urls, 1) AS image_count
FROM vehicles
WHERE array_length(image_urls, 1) IS NULL OR array_length(image_urls, 1) = 0
ORDER BY make, model;
