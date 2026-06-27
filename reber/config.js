// ==========================================================================
// BERZAN İç Panel — Bağlantı Ayarları
// Bu iki değeri Supabase panelinizden alıp aşağıya yapıştırın (KURULUM.md).
// Supabase → Project Settings → API:
//   - Project URL  -> SUPABASE_URL
//   - anon public  -> SUPABASE_ANON_KEY  (gizli değil; RLS koruması sağlar)
// ==========================================================================
window.REBER_CONFIG = {
  SUPABASE_URL: "https://ibenluhsxkyaijaqqioc.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliZW5sdWhzeGt5YWlqYXFxaW9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1Njk4NjksImV4cCI6MjA5ODE0NTg2OX0.KTCaADKE-M0-vBX06htW9XEaYbazcWWLa-xcVVxlRts",

  INACTIVITY_MINUTES: 30,                    // bu kadar dk işlemsizlikte otomatik çıkış
  USERNAME_DOMAIN: "@reber.berzan.local"     // kullanıcı adı -> e-posta dönüşümü
};
