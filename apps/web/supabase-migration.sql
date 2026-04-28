-- HaulFlow Database Migration
-- Run this in your Supabase SQL Editor

create table if not exists public.loads (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null,
  job_name text not null,
  material text,
  rate numeric(10,2) not null default 0,
  driver_name text not null,
  date date not null,
  status text not null default 'pending' check (status in ('pending','invoiced','paid')),
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.drivers (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null,
  name text not null,
  email text,
  phone text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now()
);

create table if not exists public.invoices (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null,
  invoice_number text not null,
  client_name text not null,
  total numeric(10,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','paid','overdue')),
  due_date date,
  created_at timestamptz default now()
);

create table if not exists public.invoice_items (
  id uuid default gen_random_uuid() primary key,
  invoice_id uuid references public.invoices(id) on delete cascade,
  load_id uuid references public.loads(id) on delete set null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  rate numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0
);

create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  company_id uuid not null,
  description text not null,
  amount numeric(10,2) not null default 0,
  category text not null default 'other',
  date date not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.loads enable row level security;
alter table public.drivers enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.expenses enable row level security;

-- RLS Policies (company_id = auth.uid())
create policy "Users manage own loads" on public.loads
  for all using (company_id = auth.uid());

create policy "Users manage own drivers" on public.drivers
  for all using (company_id = auth.uid());

create policy "Users manage own invoices" on public.invoices
  for all using (company_id = auth.uid());

create policy "Users manage own invoice items" on public.invoice_items
  for all using (invoice_id in (
    select id from public.invoices where company_id = auth.uid()
  ));

create policy "Users manage own expenses" on public.expenses
  for all using (company_id = auth.uid());
