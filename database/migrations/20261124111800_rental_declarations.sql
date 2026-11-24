create table public.rental_declarations (
  id uuid primary key,
  request_hash text not null check (length(request_hash) = 64),
  full_name text not null,
  locale text not null check (locale in ('he', 'en')),
  form_data jsonb not null check (jsonb_typeof(form_data) = 'object'),
  card_ciphertext text not null,
  signature_type text not null check (signature_type in ('typed', 'drawn')),
  signed_at timestamptz not null,
  pdf_base64 text not null check (length(pdf_base64) between 1 and 2500000),
  office_email_sent_at timestamptz,
  office_email_id text
);
create index rental_declarations_signed_at_idx on public.rental_declarations (signed_at desc);
alter table public.rental_declarations enable row level security;
revoke all on table public.rental_declarations from public, anon, authenticated;
grant select, insert, update on table public.rental_declarations to service_role;

create table public.rental_declaration_card_access (
  declaration_id uuid not null references public.rental_declarations(id),
  revealed_at timestamptz not null default now()
);
alter table public.rental_declaration_card_access enable row level security;
revoke all on table public.rental_declaration_card_access from public, anon, authenticated;
grant select, insert on table public.rental_declaration_card_access to service_role;
