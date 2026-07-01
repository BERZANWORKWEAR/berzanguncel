-- ==========================================================================
-- BERZAN İç Panel — FAZ 3: cari (müşteriler), tahsilat/ödeme, dosya ekleri,
--   bildirimler, aktivite geçmişi (audit), ürün kataloğu, arşiv (soft-delete)
-- schema.sql + basvurular.sql + schema-v2.sql çalıştırıldıktan SONRA Run edin.
-- Tekrar çalıştırılabilir (idempotent).
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- 0) PROFİL E-POSTA (Kullanıcılar ekranı + şifre sıfırlama maili için)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email
from auth.users u where u.id = p.id and (p.email is null or p.email <> u.email);

-- Yeni kullanıcı eklenince profil (ad + email + varsayılan calisan)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, ad, email, rol)
  values (new.id, split_part(new.email, '@', 1), new.email, 'calisan')
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 1) MÜŞTERİLER (cari)
-- ---------------------------------------------------------------------------
create table if not exists public.musteriler (
  id         uuid primary key default gen_random_uuid(),
  firma      text not null,
  yetkili    text,
  telefon    text,
  eposta     text,
  adres      text,
  vergi_no   text,
  notlar     text,
  arsiv      boolean not null default false,
  ekleyen    uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- Talep & sipariş → müşteri ilişkisi (mevcut serbest metin 'musteri' alanı korunur)
alter table public.talepler   add column if not exists musteri_id uuid references public.musteriler(id) on delete set null;
alter table public.siparisler add column if not exists musteri_id uuid references public.musteriler(id) on delete set null;

-- Arşiv (soft-delete) kolonları
alter table public.talepler     add column if not exists arsiv boolean not null default false;
alter table public.tedarikciler add column if not exists arsiv boolean not null default false;
alter table public.siparisler   add column if not exists arsiv boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2) TAHSİLAT & ÖDEME (nakit akışı için hareket defteri)
--    yon='musteri' → müşteriden tahsil edilen ; yon='tedarikci' → tedarikçiye ödenen
-- ---------------------------------------------------------------------------
create table if not exists public.odemeler (
  id         uuid primary key default gen_random_uuid(),
  siparis_id uuid references public.siparisler(id) on delete cascade,
  yon        text not null check (yon in ('musteri','tedarikci')),
  tutar      numeric not null default 0,
  tarih      date not null default current_date,
  yontem     text,                       -- Havale/EFT, Nakit, Çek, Kredi Kartı...
  notlar     text,
  ekleyen    uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_odemeler_siparis on public.odemeler(siparis_id);

-- ---------------------------------------------------------------------------
-- 3) DOSYA EKLERİ (metadata) + Storage bucket
-- ---------------------------------------------------------------------------
create table if not exists public.ekler (
  id         uuid primary key default gen_random_uuid(),
  kayit_tipi text not null,              -- talep | teklif | siparis | musteri | tedarikci
  kayit_id   uuid not null,
  dosya_adi  text not null,
  yol        text not null,             -- storage'daki path
  mime       text,
  boyut      bigint,
  ekleyen    uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_ekler_kayit on public.ekler(kayit_tipi, kayit_id);

-- Özel (private) storage bucket
insert into storage.buckets (id, name, public)
values ('ekler','ekler', false)
on conflict (id) do nothing;

-- Bucket politikaları: yalnız giriş yapmış kullanıcı yükler/okur/siler
drop policy if exists ekler_read   on storage.objects;
drop policy if exists ekler_insert on storage.objects;
drop policy if exists ekler_delete on storage.objects;
create policy ekler_read   on storage.objects for select to authenticated using (bucket_id = 'ekler');
create policy ekler_insert on storage.objects for insert to authenticated with check (bucket_id = 'ekler');
create policy ekler_delete on storage.objects for delete to authenticated using (bucket_id = 'ekler');

-- ---------------------------------------------------------------------------
-- 4) AKTİVİTE GEÇMİŞİ (audit log)
-- ---------------------------------------------------------------------------
create table if not exists public.aktiviteler (
  id          uuid primary key default gen_random_uuid(),
  kayit_tipi  text not null,             -- talep | siparis | musteri | tedarikci | teklif
  kayit_id    uuid,
  islem       text not null,            -- oluşturuldu | durum: X | aşama: Y | ödeme eklendi ...
  detay       text,
  kullanici   uuid default auth.uid(),
  kullanici_ad text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_aktiviteler_kayit on public.aktiviteler(kayit_tipi, kayit_id);

-- ---------------------------------------------------------------------------
-- 5) BİLDİRİMLER
-- ---------------------------------------------------------------------------
create table if not exists public.bildirimler (
  id           uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references auth.users(id) on delete cascade,
  tip          text,                     -- atama | basvuru | odeme | sistem
  mesaj        text not null,
  link         text,                     -- panel sekmesi (talepler, webbasvuru...)
  okundu       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_bildirimler_kullanici on public.bildirimler(kullanici_id, okundu);

-- Yeni web başvurusu gelince tüm yöneticilere bildirim (site formu anon insert eder)
create or replace function public.notify_yoneticiler_basvuru()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.bildirimler (kullanici_id, tip, mesaj, link)
  select p.id, 'basvuru',
         'Yeni web başvurusu: ' || coalesce(new.ad_soyad, new.firma, '—') || ' (' || coalesce(new.tip,'?') || ')',
         'webbasvuru'
  from public.profiles p where p.rol = 'yonetici';
  return new;
end $$;
drop trigger if exists trg_basvuru_bildirim on public.basvurular;
create trigger trg_basvuru_bildirim after insert on public.basvurular
  for each row execute function public.notify_yoneticiler_basvuru();

-- ---------------------------------------------------------------------------
-- 6) ÜRÜN KATALOĞU (fiyat geçmişi referansı)
-- ---------------------------------------------------------------------------
create table if not exists public.urunler (
  id         uuid primary key default gen_random_uuid(),
  ad         text not null,
  kategori   text,
  birim      text,                       -- adet, kg, m, paket...
  son_alis   numeric,
  son_satis  numeric,
  notlar     text,
  ekleyen    uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 7) RLS — yeni tablolar
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['musteriler','odemeler','ekler','urunler'] loop
    execute format('alter table public.%I enable row level security', t);
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

-- aktiviteler: herkes okur & ekler; güncelleme/silme YOK (değiştirilemez kayıt)
alter table public.aktiviteler enable row level security;
drop policy if exists sel_aktiviteler on public.aktiviteler;
drop policy if exists ins_aktiviteler on public.aktiviteler;
create policy sel_aktiviteler on public.aktiviteler for select to authenticated using (true);
create policy ins_aktiviteler on public.aktiviteler for insert to authenticated with check (true);

-- bildirimler: kullanıcı yalnız KENDİ bildirimlerini görür/günceller; insert authenticated
alter table public.bildirimler enable row level security;
drop policy if exists sel_bildirimler on public.bildirimler;
drop policy if exists ins_bildirimler on public.bildirimler;
drop policy if exists upd_bildirimler on public.bildirimler;
drop policy if exists del_bildirimler on public.bildirimler;
create policy sel_bildirimler on public.bildirimler for select to authenticated using (kullanici_id = auth.uid());
create policy ins_bildirimler on public.bildirimler for insert to authenticated with check (true);
create policy upd_bildirimler on public.bildirimler for update to authenticated using (kullanici_id = auth.uid()) with check (kullanici_id = auth.uid());
create policy del_bildirimler on public.bildirimler for delete to authenticated using (kullanici_id = auth.uid());

-- ==========================================================================
-- Bitti. Cari, tahsilat/ödeme, ekler (+bucket), aktivite, bildirim, ürün kuruldu.
-- ==========================================================================
