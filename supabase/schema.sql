-- Schéma de Budget pour Supabase.
-- À exécuter une fois : Dashboard → SQL Editor → coller ce fichier → Run.

-- Transactions
create table public.transactions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  amount double precision not null,
  type text not null check (type in ('expense', 'income')),
  category text not null,
  label text not null default '',
  date date not null,
  recurring_id text,
  created_at bigint not null,
  primary key (user_id, id)
);

-- Charges fixes / revenus récurrents
create table public.recurring (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  label text not null default '',
  amount double precision not null,
  type text not null check (type in ('expense', 'income')),
  category text not null,
  day_of_month int not null check (day_of_month between 1 and 31),
  active boolean not null default true,
  start_month text not null,
  last_generated text,
  primary key (user_id, id)
);

-- Catégories apprises (libellé normalisé -> catégorie)
create table public.learned (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  category text not null,
  primary key (user_id, key)
);

-- Réglages (une ligne par utilisateur)
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb
);

-- Row Level Security : chaque utilisateur ne voit et ne modifie que ses lignes.
alter table public.transactions enable row level security;
alter table public.recurring enable row level security;
alter table public.learned enable row level security;
alter table public.user_settings enable row level security;

create policy "own transactions" on public.transactions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own recurring" on public.recurring for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own learned" on public.learned for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own settings" on public.user_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Temps réel : la synchro entre appareils se met à jour sans recharger.
alter publication supabase_realtime add table public.transactions, public.recurring, public.learned, public.user_settings;
