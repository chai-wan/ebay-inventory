import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { extractEbayItemId } from "@/lib/utils"
import { tradingCall } from "@/lib/ebay-trading"

// eBayで出品中の商品を読み取り、まだ登録されていないものを「有在庫」として追加する。
// 読み取りだけで、eBayの出品は変えない。在庫監視は「保留」（Pixelのチェック対象外）。
export const dynamic = "force-dynamic"
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const num = (v: string) => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

export async function POST() {
  type Listing = { itemId: string; title: string; price: number; qty: number }
  const listings: Listing[] = []

  for (let page = 1; page <= 10; page++) {
    const r = await tradingCall(
      "GetMyeBaySelling",
      `<ActiveList><Include>true</Include><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination></ActiveList>
  <DetailLevel>ReturnAll</DetailLevel>`
    )
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 502 })
    const $ = r.$
    $("ActiveList > ItemArray > Item").each((_, el) => {
      const it = $(el)
      const itemId = it.children("ItemID").text()
      if (!itemId) return
      const qty = parseInt(it.children("QuantityAvailable").text())
      listings.push({
        itemId,
        title: it.children("Title").text(),
        price: num(it.find("SellingStatus > CurrentPrice").first().text() || it.children("BuyItNowPrice").text()),
        qty: Number.isFinite(qty) ? qty : parseInt(it.children("Quantity").text()) || 0,
      })
    })
    const totalPages = parseInt($("ActiveList > PaginationResult > TotalNumberOfPages").text()) || 1
    if (page >= totalPages) break
  }

  // すでに登録済みのItemIDは追加しない
  const { data: existing, error: readErr } = await supabase.from("procurement_settings").select("ebay_url")
  if (readErr) return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 })
  const known = new Set((existing ?? []).map((r) => extractEbayItemId(r.ebay_url)).filter(Boolean))

  const rows = listings
    .filter((l) => !known.has(l.itemId))
    .map((l) => ({
      site_name: "stock",
      product_url: "",
      ebay_url: `https://www.ebay.com/itm/${l.itemId}`,
      ebay_product_name: l.title,
      selling_price_usd: l.price,
      ebay_quantity: l.qty,
      mercari_status: "hold",
      status: "stopped",
      memo: "eBayから取り込み",
    }))

  if (rows.length > 0) {
    const { error } = await supabase.from("procurement_settings").insert(rows)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    found: listings.length,
    added: rows.length,
    outOfStock: listings.filter((l) => l.qty === 0).length,
  })
}
