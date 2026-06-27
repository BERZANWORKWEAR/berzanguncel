-- ==========================================================================
-- BERZAN İç Yönetim Paneli — Supabase Veritabanı Şeması
-- Bu dosyanın TAMAMINI Supabase → SQL Editor'e yapıştırıp "Run" deyin.
-- Tekrar çalıştırılabilir (idempotent): var olan nesneleri bozmaz.
-- ==========================================================================

-- ---------------------------------------------------------------------------
-- 1) TABLOLAR
-- ---------------------------------------------------------------------------

-- Tedarikçiler
create table if not exists public.tedarikciler (
  id              uuid primary key default gen_random_uuid(),
  firma           text not null,
  kategori        text check (kategori in
                    ('Matbaa/Kağıt','İş Kıyafeti/Atölye','Promosyon',
                     'Ambalaj/Poşet','İş Güvenliği-KKD','Diğer')),
  iletisim_kisi   text,
  telefon         text,
  eposta          text,
  min_siparis     numeric,
  ort_teslim_gun  integer,
  odeme_vadesi    text,
  kalite          integer check (kalite between 1 and 5),
  notlar          text,
  created_at      timestamptz not null default now()
);

-- Talepler (pipeline)
create sequence if not exists public.talep_seq;

create table if not exists public.talepler (
  id                  uuid primary key default gen_random_uuid(),
  talep_no            text unique,
  tarih               date not null default current_date,
  musteri             text not null,
  iletisim_kisi       text,
  urun_kategori       text,
  adet                numeric default 1,
  spesifikasyon       text,
  istenen_teslim      date,
  durum               text not null default 'Yeni' check (durum in
                        ('Yeni','Fiyat Bekleniyor','Teklif Sunuldu',
                         'Takipte','Kazanıldı','Kaybedildi')),
  sonraki_adim        text,
  sonraki_adim_tarihi date,
  kayip_nedeni        text check (kayip_nedeni in
                        ('İletişim','Fiyat','Zamanlama','Diğer')),
  notlar              text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Teklifler (bir talebe birden çok tedarikçi teklifi)
create table if not exists public.teklifler (
  id            uuid primary key default gen_random_uuid(),
  talep_id      uuid not null references public.talepler(id) on delete cascade,
  tedarikci_id  uuid references public.tedarikciler(id) on delete set null,
  tedarikci_adi text,                       -- görüntü için anlık kopya
  birim_fiyat   numeric not null default 0,
  teslim_gun    integer,
  vade          text,
  kalite        integer check (kalite between 1 and 5),
  secildi       boolean not null default false,
  kar_marji     numeric,                     -- yüzde; yalnız seçilen teklifte
  created_at    timestamptz not null default now()
);

-- Siparişler
create sequence if not exists public.siparis_seq;

create table if not exists public.siparisler (
  id              uuid primary key default gen_random_uuid(),
  siparis_no      text unique,
  talep_id        uuid references public.talepler(id) on delete set null,
  musteri         text,
  tedarikci       text,
  urun            text,
  adet            numeric default 1,
  maliyet         numeric default 0,
  satis           numeric default 0,
  kar             numeric generated always as (coalesce(satis,0) - coalesce(maliyet,0)) stored,
  kar_yuzde       numeric generated always as (
                    case when coalesce(maliyet,0) > 0
                      then round(((coalesce(satis,0) - maliyet) / maliyet) * 100, 2)
                      else 0 end) stored,
  asama           text not null default 'Sipariş verildi' check (asama in
                    ('Sipariş verildi','Üretimde','Kalite kontrol',
                     'Sevkiyatta','Teslim edildi')),
  musteri_odeme   text default 'Bekliyor' check (musteri_odeme in ('Bekliyor','Kısmi','Ödendi')),
  tedarikci_odeme text default 'Bekliyor' check (tedarikci_odeme in ('Bekliyor','Kısmi','Ödendi')),
  teslim_tarihi   date,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) FONKSİYONLAR & TRIGGER'LAR
-- ---------------------------------------------------------------------------

-- Talep no: TLP-YYYY-#### + updated_at güncelle
create or replace function public.set_talep_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.talep_no is null then
    new.talep_no := 'TLP-' || to_char(now(),'YYYY') || '-' ||
                    lpad(nextval('public.talep_seq')::text, 4, '0');
  end if;
  return new;
end $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_talep_no on public.talepler;
create trigger trg_talep_no
  before insert on public.talepler
  for each row execute function public.set_talep_no();

drop trigger if exists trg_talep_updated on public.talepler;
create trigger trg_talep_updated
  before update on public.talepler
  for each row execute function public.touch_updated_at();

-- Sipariş no: SIP-YYYY-####
create or replace function public.set_siparis_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.siparis_no is null then
    new.siparis_no := 'SIP-' || to_char(now(),'YYYY') || '-' ||
                      lpad(nextval('public.siparis_seq')::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_siparis_no on public.siparisler;
create trigger trg_siparis_no
  before insert on public.siparisler
  for each row execute function public.set_siparis_no();

-- Talep "Kazanıldı" olunca otomatik Sipariş Takibi'ne taşı
create or replace function public.talep_kazanildi_siparis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secili     public.teklifler%rowtype;
  v_maliyet    numeric := 0;
  v_satis      numeric := 0;
  v_tedarikci  text := null;
begin
  if new.durum = 'Kazanıldı' and (old.durum is distinct from 'Kazanıldı') then
    -- Bu talep için zaten sipariş varsa tekrar oluşturma
    if exists (select 1 from public.siparisler where talep_id = new.id) then
      return new;
    end if;

    -- Seçili teklifi bul
    select * into v_secili from public.teklifler
      where talep_id = new.id and secildi = true
      order by created_at desc limit 1;

    if found then
      v_maliyet := coalesce(v_secili.birim_fiyat,0) * coalesce(new.adet,1);
      if v_secili.kar_marji is not null then
        v_satis := v_maliyet * (1 + v_secili.kar_marji / 100.0);
      end if;
      v_tedarikci := coalesce(
        v_secili.tedarikci_adi,
        (select firma from public.tedarikciler where id = v_secili.tedarikci_id));
    end if;

    insert into public.siparisler
      (talep_id, musteri, tedarikci, urun, adet, maliyet, satis, asama)
    values
      (new.id, new.musteri, v_tedarikci, coalesce(new.urun_kategori,''),
       coalesce(new.adet,1), v_maliyet, v_satis, 'Sipariş verildi');
  end if;
  return new;
end $$;

drop trigger if exists trg_talep_kazanildi on public.talepler;
create trigger trg_talep_kazanildi
  after update on public.talepler
  for each row execute function public.talep_kazanildi_siparis();

-- ---------------------------------------------------------------------------
-- 3) ROW LEVEL SECURITY (RLS)
--    Giriş yapmamış (anon) hiç kimse veri göremez/yazamaz.
--    Yalnız "authenticated" (giriş yapmış) kullanıcılar tüm işlemleri yapar.
-- ---------------------------------------------------------------------------

alter table public.tedarikciler enable row level security;
alter table public.talepler     enable row level security;
alter table public.teklifler    enable row level security;
alter table public.siparisler   enable row level security;

drop policy if exists auth_all_tedarikciler on public.tedarikciler;
create policy auth_all_tedarikciler on public.tedarikciler
  for all to authenticated using (true) with check (true);

drop policy if exists auth_all_talepler on public.talepler;
create policy auth_all_talepler on public.talepler
  for all to authenticated using (true) with check (true);

drop policy if exists auth_all_teklifler on public.teklifler;
create policy auth_all_teklifler on public.teklifler
  for all to authenticated using (true) with check (true);

drop policy if exists auth_all_siparisler on public.siparisler;
create policy auth_all_siparisler on public.siparisler
  for all to authenticated using (true) with check (true);

-- ==========================================================================
-- Bitti. Tablolar, otomasyonlar ve güvenlik kuralları kuruldu.
-- Sonraki adım: Authentication → Users → kullanıcı ekleyin (KURULUM.md).
-- ==========================================================================
