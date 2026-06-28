-- ==========================================================================
-- BERZAN — Web Sitesi Başvuruları Tablosu
-- Ana sitedeki iletişim formu + "Müşterimiz/Tedarikçimiz Ol" buraya yazar.
-- Bu dosyanın TAMAMINI Supabase → SQL Editor'e yapıştırıp "Run" deyin (bir kez).
-- Tekrar çalıştırılabilir (idempotent).
-- ==========================================================================

create table if not exists public.basvurular (
  id          uuid primary key default gen_random_uuid(),
  tip         text not null default 'Genel' check (tip in ('Müşteri','Tedarikçi','Genel')),
  ad_soyad    text,
  firma       text,
  eposta      text,
  telefon     text,
  mesaj       text,
  durum       text not null default 'Yeni' check (durum in ('Yeni','İşlendi','Kapandı')),
  created_at  timestamptz not null default now()
);

-- RLS: anon (giriş yapmamış site ziyaretçisi) YALNIZ ekleyebilir, okuyamaz.
-- authenticated (panel kullanıcısı) her şeyi yapar (başvuruları görür/işler).
alter table public.basvurular enable row level security;

drop policy if exists basvuru_insert_anon on public.basvurular;
create policy basvuru_insert_anon on public.basvurular
  for insert to anon with check (true);

drop policy if exists basvuru_all_auth on public.basvurular;
create policy basvuru_all_auth on public.basvurular
  for all to authenticated using (true) with check (true);

-- ==========================================================================
-- Bitti. Site formundan gelen başvurular bu tabloya düşer; panelden görülecek.
-- ==========================================================================
