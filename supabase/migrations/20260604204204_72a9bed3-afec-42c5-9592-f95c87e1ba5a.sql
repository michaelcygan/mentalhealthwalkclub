create table if not exists public.merch_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 50),
  currency text not null default 'usd',
  image_url text,
  inventory integer,
  is_active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.merch_products to anon, authenticated;
grant all on public.merch_products to service_role;
alter table public.merch_products enable row level security;
create policy "Anyone can view active products" on public.merch_products for select using (is_active = true or public.has_role(auth.uid(), 'admin'::app_role));
create policy "Admins manage products" on public.merch_products for all to authenticated using (public.has_role(auth.uid(), 'admin'::app_role)) with check (public.has_role(auth.uid(), 'admin'::app_role));

create table if not exists public.merch_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  product_id uuid references public.merch_products(id) on delete set null,
  quantity integer not null default 1 check (quantity > 0),
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'pending',
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  shipping_address jsonb,
  environment text not null default 'sandbox',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.merch_orders to authenticated;
grant all on public.merch_orders to service_role;
alter table public.merch_orders enable row level security;
create policy "Owners view own orders" on public.merch_orders for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'::app_role));
create policy "Owners insert own orders" on public.merch_orders for insert to authenticated with check (auth.uid() = user_id);
create policy "Admins update orders" on public.merch_orders for update to authenticated using (public.has_role(auth.uid(), 'admin'::app_role)) with check (public.has_role(auth.uid(), 'admin'::app_role));

create index if not exists merch_orders_user_idx on public.merch_orders(user_id, created_at desc);
create index if not exists merch_products_active_idx on public.merch_products(is_active, sort);