// assets/js/supabaseClient.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cfg = window.__SUPABASE__ || {};
const url = cfg.url;
const anonKey = cfg.anonKey;

if (!url || !anonKey || String(url).includes("PASTE_") || String(anonKey).includes("PASTE_")) {
  console.warn("[Supabase] config.js içine URL ve ANON KEY girmen lazım. window.__SUPABASE__ boş.");
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false }
});
