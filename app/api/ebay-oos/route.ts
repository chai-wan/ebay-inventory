import { NextResponse } from "next/server"
import { tradingCall } from "@/lib/ebay-trading"

// eBayの「在庫切れでも出品を残す」設定(Out-of-stock control)の確認とON
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const r = await tradingCall("GetUserPreferences", "<ShowOutOfStockControlPreference>true</ShowOutOfStockControlPreference>")
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 })
    return NextResponse.json({ ok: true, enabled: r.$("OutOfStockControlPreference").first().text() === "true" })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const r = await tradingCall("SetUserPreferences", "<OutOfStockControlPreference>true</OutOfStockControlPreference>")
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 })
    return NextResponse.json({ ok: true, enabled: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
