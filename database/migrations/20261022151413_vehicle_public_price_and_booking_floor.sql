-- Optional values leave every existing vehicle's behaviour unchanged.
alter table public.vehicles
  add column display_price_per_day numeric(10,2) check (display_price_per_day > 0),
  add column minimum_daily_price numeric(10,2) check (minimum_daily_price > 0);

comment on column public.vehicles.display_price_per_day is 'Catalogue-only starting price, never a booking calculation input';
comment on column public.vehicles.minimum_daily_price is 'Minimum online vehicle rental rate after seasonal and duration discounts';
