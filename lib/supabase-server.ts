import { createClient } from "@supabase/supabase-js"

// サーバー（API・定時処理）用。合言葉（DB_GATE_SECRET）を付けてDBへつなぐ。
// 値はVercelの環境変数とSupabaseのVault（db_gate_secret）にだけある。
export function serverSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-db-gate": process.env.DB_GATE_SECRET ?? "" } },
  })
}
