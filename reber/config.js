// ==========================================================================
// BERZAN İç Panel — Bağlantı Ayarları
// Bu iki değeri Supabase panelinizden alıp aşağıya yapıştırın (KURULUM.md).
// Supabase → Project Settings → API:
//   - Project URL  -> SUPABASE_URL
//   - anon public  -> SUPABASE_ANON_KEY  (gizli değil; RLS koruması sağlar)
// ==========================================================================
window.REBER_CONFIG = {
  SUPABASE_URL: "BURAYA_PROJE_URL",         // örn: https://abcdxyz.supabase.co
  SUPABASE_ANON_KEY: "BURAYA_ANON_KEY",     // "anon public" anahtarı

  INACTIVITY_MINUTES: 30,                    // bu kadar dk işlemsizlikte otomatik çıkış
  USERNAME_DOMAIN: "@reber.berzan.local"     // kullanıcı adı -> e-posta dönüşümü
};
