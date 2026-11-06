-- Hondana : comptes, pages publiques et bibliothèques.
-- À coller dans Supabase → SQL Editor → New query, puis « Run ». Peut être relancé sans risque.

-- Profils : un par compte, avec le pseudo qui sert d'adresse publique (/u/pseudo).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique
    check (username ~ '^[a-z0-9_-]{3,24}$')
    check (username not in ('admin', 'api', 'app', 'u', 'login', 'compte', 'hondana', 'support', 'aide')),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

-- Séries : une ligne par manga ou anime de la bibliothèque.
create table if not exists public.series (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 40),
  kind text not null check (kind in ('manga', 'anime')),
  title text not null check (char_length(title) between 1 and 200),
  done integer not null default 0 check (done between 0 and 3000),
  owned integer not null default 0 check (owned between 0 and 3000),
  total integer not null default 0 check (total between 0 and 3000),
  status text not null default 'en_cours' check (status in ('en_cours', 'termine', 'pause', 'a_lire', 'abandonne')),
  score integer not null default 0 check (score between 0 and 10),
  mal_id integer,
  extra jsonb not null default '{}'::jsonb check (pg_column_size(extra) < 60000),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
-- ajout de la colonne sur une base créée avant les tomes possédés
alter table public.series add column if not exists owned integer not null default 0 check (owned between 0 and 3000);
create index if not exists series_user_kind on public.series (user_id, kind);

-- Garde la date de mise à jour à jour.
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists series_touch on public.series;
create trigger series_touch before update on public.series
  for each row execute function public.touch_updated_at();

-- Règles d'accès : tout le monde peut lire une page publique, seul le propriétaire peut modifier.
alter table public.profiles enable row level security;
alter table public.series enable row level security;

drop policy if exists "profils visibles" on public.profiles;
create policy "profils visibles" on public.profiles for select
  using (is_public or id = auth.uid());
drop policy if exists "créer son profil" on public.profiles;
create policy "créer son profil" on public.profiles for insert
  with check (id = auth.uid());
drop policy if exists "modifier son profil" on public.profiles;
create policy "modifier son profil" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "supprimer son profil" on public.profiles;
create policy "supprimer son profil" on public.profiles for delete
  using (id = auth.uid());

drop policy if exists "séries visibles" on public.series;
create policy "séries visibles" on public.series for select
  using (user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = series.user_id and p.is_public));
drop policy if exists "ajouter ses séries" on public.series;
create policy "ajouter ses séries" on public.series for insert
  with check (user_id = auth.uid());
drop policy if exists "modifier ses séries" on public.series;
create policy "modifier ses séries" on public.series for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "retirer ses séries" on public.series;
create policy "retirer ses séries" on public.series for delete
  using (user_id = auth.uid());

grant select on public.profiles, public.series to anon, authenticated;
grant insert, update, delete on public.profiles, public.series to authenticated;
