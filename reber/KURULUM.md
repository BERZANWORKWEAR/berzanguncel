# BERZAN İç Panel — Kurulum Rehberi

Panel `berzan.com.tr/reber` adresinde açılır. Veriler **Supabase** (ücretsiz) üzerinde,
giriş yapılmadan kimse göremez. Aşağıdaki adımları **bir kez** yapmanız yeterli.

---

## 1. Supabase projesi oluştur

1. https://supabase.com → **Start your project** → GitHub/e-posta ile ücretsiz kayıt ol.
2. **New project** → İsim: `berzan-panel`, güçlü bir veritabanı şifresi belirle (bir yere not et).
3. Bölge: **Frankfurt (eu-central)** seç (Türkiye'ye en yakın). **Create new project** de, ~1 dk bekle.

## 2. Veritabanını kur (tablolar + güvenlik)

1. Sol menü → **SQL Editor** → **New query**.
2. `reber/schema.sql` dosyasının **tamamını** kopyala, editöre yapıştır.
3. Sağ altta **Run** (veya ⌘/Ctrl+Enter). "Success" görmelisin.
   - Bu adım 4 tabloyu, otomatik numaralandırmayı, "Kazanıldı → Sipariş" otomasyonunu
     ve **RLS güvenlik kurallarını** kurar.

## 3. Kullanıcı(ları) ekle

1. Sol menü → **Authentication** → **Users** → **Add user** → **Create new user**.
2. **Email** alanına kullanıcı adını şu formatta yaz: `kullaniciadi@reber.berzan.local`
   - Örnek: kullanıcı adı **berzan** olacaksa → `berzan@reber.berzan.local`
3. **Password** belirle. **Auto Confirm User** açık olsun. **Create user**.
4. Birden çok kişi için bu adımı tekrarla (her birine ayrı kullanıcı adı + şifre).
   - Panelde giriş yaparken sadece **kullanıcı adını** (örn. `berzan`) ve şifreyi girerler;
     `@reber.berzan.local` kısmını panel otomatik ekler.

> Not: E-posta doğrulamasını kapatmak için **Authentication → Providers → Email** altında
> "Confirm email" kapalı olabilir; "Add user" sırasında "Auto Confirm" işaretliyse gerek yok.

## 4. Bağlantı anahtarlarını panele gir

1. Sol menü → **Project Settings** (dişli) → **API**.
2. Şu iki değeri kopyala:
   - **Project URL** (örn. `https://abcdxyz.supabase.co`)
   - **Project API keys → anon public**
3. `reber/config.js` dosyasını aç, ilgili yerlere yapıştır:
   ```js
   SUPABASE_URL: "https://abcdxyz.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGci...(uzun anahtar)...",
   ```
   > `anon public` anahtarı gizli değildir; güvenlik RLS kuralları ile sağlanır.

## 5. Yayınla

`config.js` doldurulduktan sonra commit + push edilince GitHub Pages otomatik yayınlar.
Birkaç dakika içinde **https://berzan.com.tr/reber** açılır.

---

## Günlük kullanım

- **Gösterge:** açık talep, bu ay kazanılan, toplam kâr, ödeme bekleyen + adım tarihi gelen talepler.
- **Talepler:** talep ekle/düzenle; tarihi gelen talepler sarı uyarılı; kayıp nedenleri grafiği.
- **Tedarikçiler:** firma listesi, kategori filtresi, 1-5 kalite.
- **Teklif & Fiyat:** talep seç → tedarikçi teklifleri gir → en düşük vurgulanır →
  birini "Seç" + kâr marjı (%) gir → satış fiyatı ve kâr otomatik. 3 teklif girilmeden
  "Müşteriye Sun" uyarı verir.
- **Siparişler:** talep "Kazanıldı" yapılınca otomatik oluşur; aşama/ödeme güncelle;
  geciken teslim ve ödenmemiş tutarlar kırmızı vurgulu.

## Güvenlik notları

- Panele ana siteden **link yoktur**; yalnız `/reber` adresini bilenler açar.
- `robots.txt` + `noindex` ile arama motorlarına kapalıdır.
- Giriş yapılmadan **hiçbir veri** yüklenmez (Supabase RLS — sunucu tarafı koruma).
- **30 dakika** işlemsizlikte oturum otomatik kapanır (süre `config.js`'ten değişir).
- Şifreler Supabase tarafında **bcrypt** ile saklanır; düz metin tutulmaz.
