-- Internal follow-up applies only to contact-form enquiries, not bookings/bot leads.
create table if not exists public.contact_lead_followup (
  contact_lead_id text primary key references public.contact_leads(id) on delete cascade,
  status text not null default 'NEW' check(status in ('NEW','CONTACTED','QUOTED','WON','CLOSED')),
  assignee text not null default '' check(length(assignee) <= 100),
  follow_up_at timestamptz,
  internal_note text not null default '' check(length(internal_note) <= 5000),
  version integer not null default 1 check(version > 0),
  updated_at timestamptz not null default now()
);
alter table public.contact_lead_followup enable row level security;
revoke all on table public.contact_lead_followup from public, anon, authenticated;
grant select, insert, update on table public.contact_lead_followup to service_role;
