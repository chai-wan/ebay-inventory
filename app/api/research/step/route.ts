import { NextResponse } from "next/server"
import { researchStep } from "@/lib/research"

// 15分ごとの処理（Supabaseの定時実行から CRON_SECRET 付きで呼ぶ）。画面の「今すぐ進める」は POST。
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ ok: true, ...(await researchStep()) })
}

export async function POST() {
  return NextResponse.json({ ok: true, ...(await researchStep()) })
}
