import { createClient } from "@supabase/supabase-js";

const envUrl = (import.meta.env && import.meta.env.VITE_SUPABASE_URL) || "";
const envKey = (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || "";
const cfg = (typeof window !== "undefined" && window.__SUPABASE__) ? window.__SUPABASE__ : {};

const supabaseUrl = envUrl || cfg.url || "";
const supabaseAnonKey = envKey || cfg.anonKey || "";

let supabase = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
} else {
  console.warn('[Supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (or window.__SUPABASE__)');
}

if (typeof window !== "undefined") window.sb = supabase;

export { supabase };
export default supabase;
