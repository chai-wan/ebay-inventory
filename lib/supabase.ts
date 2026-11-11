import { createClient } from '@supabase/supabase-js'

// 画面（ブラウザ）用。DBへは直接つながず、自分のサイトの /api/sb を通す。
// /api/sb はログインしていないと使えず（proxy.ts）、サーバー側で合言葉を付けてDBへ渡す。
// DBは合言葉なしの読み書きを断る（RLS の db_gate_ok）。
const supabaseUrl =
  typeof window !== 'undefined' ? `${window.location.origin}/api/sb` : process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
