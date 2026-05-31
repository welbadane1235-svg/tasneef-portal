
-- V197 Orders module
create table if not exists public.maintenance_orders (
  id bigserial primary key,
  order_no text,
  group_no text,
  order_date date,
  order_time time,
  sender text,
  project_id bigint,
  property_type text,
  unit_no text,
  client_name text,
  client_phone text,
  executor text,
  details text,
  notes text,
  concern text,
  done_date date,
  execution_method text,
  execution_status text default 'لم ينفذ',
  report_status text,
  price_incl_vat numeric default 0,
  vat_amount numeric default 0,
  price_before_vat numeric default 0,
  cost numeric default 0,
  profit numeric default 0,
  payment_status text,
  invoice_no text,
  system_invoice_status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.maintenance_orders enable row level security;
drop policy if exists "maintenance_orders_select_all" on public.maintenance_orders;
drop policy if exists "maintenance_orders_insert_all" on public.maintenance_orders;
drop policy if exists "maintenance_orders_update_all" on public.maintenance_orders;
drop policy if exists "maintenance_orders_delete_all" on public.maintenance_orders;
create policy "maintenance_orders_select_all" on public.maintenance_orders for select using (true);
create policy "maintenance_orders_insert_all" on public.maintenance_orders for insert with check (true);
create policy "maintenance_orders_update_all" on public.maintenance_orders for update using (true) with check (true);
create policy "maintenance_orders_delete_all" on public.maintenance_orders for delete using (true);
create index if not exists maintenance_orders_project_idx on public.maintenance_orders(project_id);
create index if not exists maintenance_orders_date_idx on public.maintenance_orders(order_date);
