-- Short bearer links resolve only through the server; never expose this map.
create table if not exists public.quote_short_links (
  token text primary key check (token ~ '^[A-Za-z0-9_-]{16}$'),
  signed_token text not null,
  created_at timestamptz not null default now()
);
alter table public.quote_short_links enable row level security;
revoke all on table public.quote_short_links from public, anon, authenticated;
grant select, insert on table public.quote_short_links to service_role;
