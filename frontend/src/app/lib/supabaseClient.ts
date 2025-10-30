import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Buat klien sekali
const client = createClient(supabaseUrl, supabaseAnonKey);

// EKSPOR KLIEN: Panggilnya 'supabase' DAN 'supabaseBrowser' untuk kompatibilitas
// (Jika file Anda meminta salah satu dari nama ini, mereka akan mendapatkannya)
export const supabase = client;
export const supabaseBrowser = client;
