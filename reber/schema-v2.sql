-- ==========================================================================
-- BERZAN İç Panel — FAZ 2: roller, atıf (kim ekledi/güncelledi), atama, RLS ince ayar
-- schema.sql + basvurular.sql çalıştırıldıktan SONRA bunu Supabase SQL Editor'de Run edin.
-- Tekrar çalıştırılabilir (idempotent).
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- 1) PROFİLLER & ROLLER
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  ad         text,
  rol        text not null default 'calisan' check (rol in ('yonetici','calisan')),
  created_at timestamptz not null default now()
);

-- Yeni kullanıcı eklenince otomatik profil (varsayılan: calisan)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, ad, rol)
  values (new.id, split_part(new.email, '@', 1), 'calisan')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_new_user on auth.users;
create trigger trg_new_user after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mevcut kullanıcılar için profilleri doldur (ad = e-postanın @ öncesi)
insert into public.profiles (id, ad, rol)
select u.id, split_part(u.email, '@', 1), 'calisan'
from auth.users u
on conflict (id) do nothing;

-- Yönetici: mehmet@berzan.com.tr  (gerekirse buradan değiştirin)
update public.profiles set rol = 'yonetici'
where id = (select id from auth.users where email = 'mehmet@berzan.com.tr');

-- Yönetici mi? (RLS'de kullanılır)
create or replace function public.is_yonetici()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and rol = 'yonetici');
$$;

-- ---------------------------------------------------------------------------
-- 2) ATIF & ATAMA KOLONLARI
-- ---------------------------------------------------------------------------
alter table public.talepler     add column if not exists ekleyen     uuid default auth.uid();
alter table public.talepler     add column if not exists atanan      uuid references public.profiles(id) on delete set null;
alter table public.talepler     add column if not exists guncelleyen uuid;
alter table public.tedarikciler add column if not exists ekleyen     uuid default auth.uid();
alter table public.teklifler    add column if not exists ekleyen     uuid default auth.uid();
alter table public.siparisler   add column if not exists ekleyen     uuid default auth.uid();

-- talepler güncellenince updated_at + guncelleyen
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.guncelleyen := auth.uid();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 3) RLS — KARMA MODEL
--    Herkes (authenticated) okur/ekler/günceller; SİLME yalnız yöneticide.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
drop policy if exists sel_profiles on public.profiles;
create policy sel_profiles on public.profiles for select to authenticated using (true);
drop policy if exists upd_profiles on public.profiles;
create policy upd_profiles on public.profiles for update to authenticated
  using (public.is_yonetici()) with check (public.is_yonetici());

-- Yardımcı: bir tabloya granular RLS uygula
-- (talepler, tedarikciler, teklifler, siparisler)
do $$
declare t text;
begin
  foreach t in array array['talepler','tedarikciler','teklifler','siparisler'] loop
    execute format('drop policy if exists auth_all_%1$s on public.%1$s', t);
    execute format('drop policy if exists sel_%1$s on public.%1$s', t);
    execute format('drop policy if exists ins_%1$s on public.%1$s', t);
    execute format('drop policy if exists upd_%1$s on public.%1$s', t);
    execute format('drop policy if exists del_%1$s on public.%1$s', t);
    execute format('create policy sel_%1$s on public.%1$s for select to authenticated using (true)', t);
    execute format('create policy ins_%1$s on public.%1$s for insert to authenticated with check (true)', t);
    execute format('create policy upd_%1$s on public.%1$s for update to authenticated using (true) with check (true)', t);
    execute format('create policy del_%1$s on public.%1$s for delete to authenticated using (public.is_yonetici())', t);
  end loop;
end $$;

-- basvurular: anon ekler (site formu), authenticated okur/günceller, SİLME yöneticide
drop policy if exists basvuru_all_auth on public.basvurular;
drop policy if exists basvuru_sel on public.basvurular;
drop policy if exists basvuru_upd on public.basvurular;
drop policy if exists basvuru_del on public.basvurular;
create policy basvuru_sel on public.basvurular for select to authenticated using (true);
create policy basvuru_upd on public.basvurular for update to authenticated using (true) with check (true);
create policy basvuru_del on public.basvurular for delete to authenticated using (public.is_yonetici());

-- ==========================================================================
-- Bitti. Roller, atıf/atama kolonları ve ince RLS kuruldu.
-- Yönetici = mehmet@berzan.com.tr ; diğerleri çalışan.
-- ==========================================================================
