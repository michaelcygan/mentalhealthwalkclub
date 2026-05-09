create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_type text not null,
  environment text not null default 'sandbox',
  source text not null default 'client',
  stripe_subscription_id text,
  stripe_customer_id text,
  metadata jsonb not null default '{}'::jsonb,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_billing_events_user_env_created
  on public.billing_events (user_id, environment, created_at desc);

create index idx_billing_events_type
  on public.billing_events (event_type);

alter table public.billing_events enable row level security;

create policy "billing_events_select_own"
  on public.billing_events for select
  to authenticated
  using (auth.uid() = user_id);

create policy "billing_events_insert_own_client"
  on public.billing_events for insert
  to authenticated
  with check (auth.uid() = user_id and source = 'client');

create policy "billing_events_update_own_ack"
  on public.billing_events for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "billing_events_service_all"
  on public.billing_events for all
  to public
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');