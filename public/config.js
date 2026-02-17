// BERZAN runtime config (edit this file)
window.BERZAN_CFG = window.BERZAN_CFG || {
  // Make (Webhook) URL'ini buraya yapıştır:
  // Örn: https://hook.eu1.make.com/xxxxxxxxxxxxxxxxxxxx
  notifyWebhook: "https://webhook.site/89823b49-1fde-4dba-a857-c9b74f1dcfb8",

  // Bildirim (WhatsApp) hedefi — kendi numaran (başında + yok)
  notifyTo: "9054210055649"
};


// Supabase (opsiyonel)
// Burayı kendi Supabase bilgilerinle doldur (Project Settings > API)
window.__SUPABASE__ = window.__SUPABASE__ || {
  url: 'PASTE_SUPABASE_URL',
  anonKey: 'PASTE_SUPABASE_ANON_KEY',
};
