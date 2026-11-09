-- Keep the existing +13% major-holiday pricing policy populated through 2029.
-- Dates are Israel calendar dates and include the eve of each holiday period.
INSERT INTO pricing_seasons (
  id, name_he, name_en, start_date, end_date, recurs_annually, adjustment_percent, priority
) VALUES
  ('season-holiday-2027-03-passover', 'פסח 2027', 'Passover 2027', '2027-04-21', '2027-04-28', false, 13, 20),
  ('season-holiday-2027-05-shavuot', 'שבועות 2027', 'Shavuot 2027', '2027-06-10', '2027-06-11', false, 13, 20),
  ('season-holiday-2027-10-rh-sukkot', 'ראש השנה–סוכות 2027', 'Rosh Hashana–Sukkot 2027', '2027-10-01', '2027-10-21', false, 13, 20),
  ('season-holiday-2028-04-passover', 'פסח 2028', 'Passover 2028', '2028-04-10', '2028-04-17', false, 13, 20),
  ('season-holiday-2028-05-shavuot', 'שבועות 2028', 'Shavuot 2028', '2028-05-30', '2028-05-31', false, 13, 20),
  ('season-holiday-2028-09-rh-sukkot', 'ראש השנה–סוכות 2028', 'Rosh Hashana–Sukkot 2028', '2028-09-20', '2028-10-11', false, 13, 20),
  ('season-holiday-2029-03-passover', 'פסח 2029', 'Passover 2029', '2029-03-30', '2029-04-06', false, 13, 20),
  ('season-holiday-2029-05-shavuot', 'שבועות 2029', 'Shavuot 2029', '2029-05-19', '2029-05-20', false, 13, 20),
  ('season-holiday-2029-09-rh-sukkot', 'ראש השנה–סוכות 2029', 'Rosh Hashana–Sukkot 2029', '2029-09-09', '2029-09-30', false, 13, 20)
ON CONFLICT (id) DO UPDATE SET
  name_he = EXCLUDED.name_he,
  name_en = EXCLUDED.name_en,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  recurs_annually = EXCLUDED.recurs_annually,
  adjustment_percent = EXCLUDED.adjustment_percent,
  priority = EXCLUDED.priority;
