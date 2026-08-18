-- =============================================================================
-- Harnais de validation LOCALE du schéma Prodigio OS.
--
-- Reproduit, sur un PostgreSQL vierge, le strict minimum de l'environnement
-- Supabase dont dépendent les migrations : schémas `auth` / `storage`, la
-- fonction `auth.uid()`, les rôles `anon` / `authenticated` / `service_role`,
-- et les extensions utilisées.
--
-- N'est JAMAIS exécuté en production : il ne sert qu'à rejouer
-- `supabase/migrations/*.sql` hors ligne pour valider une migration avant de la
-- proposer. Aucune donnée réelle, aucun secret.
--
-- Usage (voir docs/07-SUPABASE-SETUP.md § validation locale) :
--   psql -f scripts/local-schema-harness.sql
--   for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -f "$f"; done
-- =============================================================================

create extension if not exists pgcrypto;

-- --- Rôles Supabase ----------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- Supabase accorde EXECUTE par défaut aux rôles du schéma `public` : on
-- reproduit ce comportement, sans quoi le durcissement de la surface EXECUTE
-- ne serait pas testable (voir 20260817120000_…_restrict_internal_execute).
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

-- --- Schéma `auth` -----------------------------------------------------------
create schema if not exists auth;

create table if not exists auth.users (
  id             uuid primary key default gen_random_uuid(),
  email          text,
  created_at     timestamptz not null default now(),
  last_sign_in_at timestamptz
);

-- `auth.uid()` lit le claim `sub` du JWT, comme chez Supabase. En local on
-- pilote l'identité via `set local request.jwt.claim.sub = '<uuid>'`.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to authenticated, service_role;

-- --- Schéma `storage` --------------------------------------------------------
create schema if not exists storage;

create table if not exists storage.buckets (
  id      text primary key,
  name    text not null,
  public  boolean not null default false
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  created_at timestamptz not null default now()
);

grant usage on schema storage to anon, authenticated, service_role;
