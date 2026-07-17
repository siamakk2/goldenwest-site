-- =====================================================================
-- Golden West Corporation — database schema
-- Run this once in the Supabase SQL editor (or it runs automatically
-- when Claude provisions the project). Safe to re-run.
-- =====================================================================

-- ---------- categories ----------
create table if not exists public.categories (
  id        text primary key,          -- e.g. 'chemical'
  name_en   text not null,
  name_es   text not null,
  sort      int  not null default 0
);

-- ---------- products ----------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  category_id text references public.categories(id) on delete set null,
  brand       text not null default 'Golden West',
  name_en     text not null,
  name_es     text,
  desc_en     text,
  desc_es     text,
  sizes       text[] not null default '{}',
  sds         boolean not null default false,
  tag         text,
  image_url   text,
  sort_order  int     not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_active_idx   on public.products (active);

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- ---------- row level security ----------
alter table public.categories enable row level security;
alter table public.products   enable row level security;

-- public (anon) may READ categories and ACTIVE products only
drop policy if exists cat_public_read on public.categories;
create policy cat_public_read on public.categories
  for select using (true);

drop policy if exists prod_public_read on public.products;
create policy prod_public_read on public.products
  for select using (active = true);

-- signed-in staff may do everything
drop policy if exists cat_staff_all on public.categories;
create policy cat_staff_all on public.categories
  for all to authenticated using (true) with check (true);

drop policy if exists prod_staff_all on public.products;
create policy prod_staff_all on public.products
  for all to authenticated using (true) with check (true);

-- ---------- storage bucket for product images ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- public read of images
drop policy if exists img_public_read on storage.objects;
create policy img_public_read on storage.objects
  for select using (bucket_id = 'product-images');

-- signed-in staff can upload / replace / delete images
drop policy if exists img_staff_write on storage.objects;
create policy img_staff_write on storage.objects
  for all to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');
