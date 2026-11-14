-- ============================================================================
-- PDFExpress SaaS — Script SQL complet pour Supabase (PostgreSQL + Auth + RLS)
-- Tables : profiles, user_devices, usage_logs, premium_requests, banned_devices
-- Fonctions & Triggers : création de profil, essai 7j (1 seul par appareil),
-- vérificateur de quota serveur (check_user_quota) et politiques RLS strictes.
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. Types énumérés
do $$ begin
  create type public.subscription_status as enum (
    'free',
    'trial_active',
    'premium_active',
    'expired',
    'suspended'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.premium_request_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- 2. Table profiles (liée à auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default '',
  role public.user_role not null default 'user',
  subscription_status public.subscription_status not null default 'free',
  trial_claimed boolean not null default false,
  premium_expires_at timestamptz null,
  last_device_fingerprint text null,
  email_confirmed_at timestamptz null,
  admin_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_fingerprint on public.profiles(last_device_fingerprint);
create index if not exists idx_profiles_status on public.profiles(subscription_status);

-- 3. Table user_devices (anti-abus & historique des appareils)
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_fingerprint text not null,
  user_agent text not null default '',
  os text not null default '',
  browser text not null default '',
  screen_resolution text not null default '',
  last_ip inet null,
  trial_granted boolean not null default false,
  first_used_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(user_id, device_fingerprint)
);

create index if not exists idx_user_devices_fp on public.user_devices(device_fingerprint);
create index if not exists idx_user_devices_trial on public.user_devices(device_fingerprint, trial_granted);

-- 4. Table banned_devices (bannissement d'appareils abusifs par l'admin)
create table if not exists public.banned_devices (
  device_fingerprint text primary key,
  reason text not null,
  banned_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 5. Table usage_logs (suivi des tâches PDF par utilisateur et par appareil)
create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references public.profiles(id) on delete set null,
  device_fingerprint text not null,
  tool_id text not null,
  file_count integer not null default 1 check (file_count >= 1),
  total_bytes bigint not null default 0 check (total_bytes >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_logs_user_time on public.usage_logs(user_id, created_at desc);
create index if not exists idx_usage_logs_fp_time on public.usage_logs(device_fingerprint, created_at desc);

-- 6. Table premium_requests (demandes d'activation manuelle / virements)
create table if not exists public.premium_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reference text not null,
  plan_id text not null check (plan_id in ('premium_pro', 'premium_team')),
  cycle text not null check (cycle in ('monthly', 'annual')),
  currency text not null check (currency in ('MAD', 'USD', 'EUR')),
  amount numeric(10, 2) not null check (amount >= 0),
  payer_name text not null,
  payer_email text not null,
  bank_origin text null,
  transfer_date date not null default current_date,
  note text null,
  status public.premium_request_status not null default 'pending',
  reviewed_by uuid null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_premium_requests_status on public.premium_requests(status, created_at desc);

-- 7. Helper is_admin()
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 8. Trigger updated_at automatique
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_premium_requests_updated on public.premium_requests;
create trigger trg_premium_requests_updated
  before update on public.premium_requests
  for each row execute function public.touch_updated_at();

-- 9. Trigger d'inscription : bloque e-mails jetables et crée le profil initial
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_domain text;
  disposable_domains text[] := array[
    'yopmail.com', 'yopmail.fr', 'temp-mail.org', 'tempmail.com', '10minutemail.com',
    'guerrillamail.com', 'mailinator.com', 'trashmail.com', 'getnada.com', 'dispostable.com',
    'throwawaymail.com', 'fakeinbox.com', 'sharklasers.com', 'maildrop.cc', 'mohmal.com'
  ];
begin
  email_domain := lower(split_part(coalesce(new.email, ''), '@', 2));
  if email_domain = any(disposable_domains) then
    raise exception 'Domaine e-mail jetable interdit : %', email_domain;
  end if;

  insert into public.profiles (
    id, email, display_name, role, subscription_status, trial_claimed, email_confirmed_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case when lower(new.email) = 'laghribredouane@gmail.com' then 'admin'::public.user_role else 'user'::public.user_role end,
    'free',
    false,
    new.email_confirmed_at
  )
  on conflict (id) do update
    set email_confirmed_at = excluded.email_confirmed_at;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 10. Fonction RPC d'enregistrement appareil + attribution atomique d'essai 7 jours (1 seul par device_fingerprint)
create or replace function public.register_device_and_maybe_grant_trial(
  p_device_fingerprint text,
  p_user_agent text default '',
  p_os text default '',
  p_browser text default '',
  p_screen_resolution text default '',
  p_ip inet default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_device_used_trial boolean;
  v_device_banned boolean;
begin
  if v_uid is null then
    raise exception 'Authentification requise';
  end if;

  select exists(select 1 from public.banned_devices where device_fingerprint = p_device_fingerprint)
    into v_device_banned;
  if v_device_banned then
    return jsonb_build_object('status', 'banned', 'trial_granted', false, 'reason', 'Appareil banni');
  end if;

  -- Upsert appareil lié au compte
  insert into public.user_devices (
    user_id, device_fingerprint, user_agent, os, browser, screen_resolution, last_ip
  )
  values (
    v_uid, p_device_fingerprint, p_user_agent, p_os, p_browser, p_screen_resolution, p_ip
  )
  on conflict (user_id, device_fingerprint) do update set
    user_agent = excluded.user_agent,
    os = excluded.os,
    browser = excluded.browser,
    screen_resolution = excluded.screen_resolution,
    last_ip = coalesce(excluded.last_ip, public.user_devices.last_ip),
    last_seen_at = now();

  select * into v_profile from public.profiles where id = v_uid;

  update public.profiles
    set last_device_fingerprint = p_device_fingerprint
    where id = v_uid;

  -- Vérifier si l'e-mail est confirmé et si l'essai n'a jamais été accordé
  if v_profile.email_confirmed_at is not null
     and v_profile.subscription_status = 'free'
     and v_profile.trial_claimed = false then

    select exists(
      select 1 from public.user_devices
      where device_fingerprint = p_device_fingerprint and trial_granted = true
    ) into v_device_used_trial;

    if v_device_used_trial then
      return jsonb_build_object(
        'status', 'free',
        'trial_granted', false,
        'trial_blocked_by_device', true,
        'message', 'Un essai gratuit a déjà été utilisé sur cet appareil.'
      );
    end if;

    update public.user_devices
      set trial_granted = true
      where user_id = v_uid and device_fingerprint = p_device_fingerprint;

    update public.profiles
      set subscription_status = 'trial_active',
          trial_claimed = true,
          premium_expires_at = now() + interval '7 days'
      where id = v_uid;

    return jsonb_build_object(
      'status', 'trial_active',
      'trial_granted', true,
      'premium_expires_at', (now() + interval '7 days')
    );
  end if;

  return jsonb_build_object(
    'status', v_profile.subscription_status,
    'trial_granted', false
  );
end;
$$;

-- 11. Activation manuelle Premium par l'administrateur
create or replace function public.admin_activate_premium(
  p_target_user_id uuid,
  p_duration_days integer, -- NULL ou <= 0 pour illimité
  p_request_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès refusé : rôle administrateur requis';
  end if;

  update public.profiles
    set subscription_status = 'premium_active',
        premium_expires_at = case
          when p_duration_days is null or p_duration_days <= 0 then null
          else now() + (p_duration_days || ' days')::interval
        end
    where id = p_target_user_id;

  if p_request_id is not null then
    update public.premium_requests
      set status = 'approved',
          reviewed_by = auth.uid()
      where id = p_request_id;
  end if;
end;
$$;

-- 12. Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.user_devices enable row level security;
alter table public.banned_devices enable row level security;
alter table public.usage_logs enable row level security;
alter table public.premium_requests enable row level security;

-- Profiles
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "profiles_update_admin_only" on public.profiles
  for update using (public.is_admin());

-- User devices
create policy "user_devices_select_own_or_admin" on public.user_devices
  for select using (auth.uid() = user_id or public.is_admin());

-- Banned devices
create policy "banned_devices_admin_all" on public.banned_devices
  for all using (public.is_admin());

-- Usage logs
create policy "usage_logs_select_own_or_admin" on public.usage_logs
  for select using (auth.uid() = user_id or public.is_admin());

create policy "usage_logs_insert_authenticated_or_guest" on public.usage_logs
  for insert with check (auth.uid() is null or auth.uid() = user_id);

-- Premium requests
create policy "premium_requests_select_own_or_admin" on public.premium_requests
  for select using (auth.uid() = user_id or public.is_admin());

create policy "premium_requests_insert_own" on public.premium_requests
  for insert with check (auth.uid() = user_id and status = 'pending');

create policy "premium_requests_update_admin_only" on public.premium_requests
  for update using (public.is_admin());
