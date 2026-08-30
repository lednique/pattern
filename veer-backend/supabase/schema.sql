-- Veer licensing schema for Supabase.
create extension if not exists pgcrypto;

create table if not exists public.keys (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,
  plan          text not null check (plan in ('annual','lifetime')),
  email         text,
  status        text not null default 'paid' check (status in ('paid','activated')),
  figma_user_id text,
  activated_at  timestamptz,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz
);

create table if not exists public.payments (
  id         uuid primary key default gen_random_uuid(),
  inv_id     bigint unique,
  plan       text not null check (plan in ('annual','lifetime')),
  email      text,
  amount     text,
  currency   text not null default 'RUB' check (currency = 'RUB'),
  coupon     text,
  status     text not null default 'pending' check (status in ('pending','succeeded','canceled')),
  key_id     uuid references public.keys(id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at    timestamptz
);

create table if not exists public.coupons (
  id         uuid primary key default gen_random_uuid(),
  code       text unique not null,
  percent    integer not null check (percent between 1 and 100),
  created_at timestamptz not null default now()
);

create index if not exists idx_veer_keys_key on public.keys(key);
create index if not exists idx_veer_keys_figma on public.keys(figma_user_id);
create index if not exists idx_veer_payments_inv on public.payments(inv_id);
create index if not exists idx_veer_coupons_code on public.coupons(code);

alter table public.keys enable row level security;
alter table public.payments enable row level security;
alter table public.coupons enable row level security;
-- No anonymous policies are intentionally created. The Vercel API uses service_role.
