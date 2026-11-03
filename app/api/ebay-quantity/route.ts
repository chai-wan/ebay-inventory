import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { extractEbayItemId } from "@/lib/utils"
import { tradingCall } from "@/lib/ebay-trading"

// eBayの出品数を変える。0なら「在庫切れで出品を残す」、1以上なら再出品して監視を再開。
export const dynamic = "force-dynamic"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  const { id, quantity } = await req.json().catch(() => ({}))
  const qty = Number(quantity)
  if (!id || !Number.isInteger(qty) || qty < 0 || qty > 99) {
    return NextResponse.json({ ok: false, error: "数量は0〜99の整数で入れてください" }, { status: 400 })
  }

  const { data: row, error: readErr } = await supabase
    .from("procurement_settings")
    .select("id, ebay_url, site_name")
    .eq("id", id)
    .single()
  if (readErr || !row) return NextResponse.json({ ok: false, error: "商品が見つかりません" }, { status: 404 })

  const itemId = extractEbayItemId(row.ebay_url)
  if (!itemId) return NextResponse.json({ ok: false, error: "eBay URLからItemIDを取り出せません" }, { status: 400 })

  const r = await tradingCall(
    "ReviseInventoryStatus",
    `<InventoryStatus><ItemID>${itemId}</ItemID><Quantity>${qty}</Quantity></InventoryStatus>`
  )
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 })

  const { error: upErr } = await supabase
    .from("procurement_settings")
    .update({
      ebay_quantity: qty,
      // 有在庫（手持ち）は仕入れ先の監視をしないので、常に hold のまま
      mercari_status: row.site_name === "stock" ? "hold" : qty > 0 ? "active" : "hold",
    })
    .eq("id", id)
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, itemId, quantity: qty })
}
