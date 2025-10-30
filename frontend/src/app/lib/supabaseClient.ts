// Contoh isi file supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

// Klien untuk Server Side Rendering (SSR) atau browser
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Jika Anda juga mengimpor 'supabase' (tanpa 'Browser'), 
// pastikan Anda mengekspornya:
export const supabase = supabaseBrowser; 

// Atau jika hanya satu yang diekspor, ubah semua file yang mengimpor:
// export const supabase = createClient(...)
// Lalu ganti semua import dari:
// import { supabaseBrowser } from "..."; 
// menjadi: 
// import { supabase } from "...";
