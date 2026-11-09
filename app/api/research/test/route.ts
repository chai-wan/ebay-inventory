import { NextResponse } from "next/server"
import { tradingCall } from "@/lib/ebay-trading"

// 試作：他のセラーの出品と売れた数が取れるかを確かめる（読み取りのみ）
// /api/research/test?seller=asatan_japan        … 直近30日に終わった出品と、今出品中で売れた数がある出品
// /api/research/test?item=123456789012           … 1件の出品の状態と売れた数
export const dynamic = "force-dynamic"
export const maxDuration = 60

type Row = { itemId: string; title: string; price: string; currency: string; qtySold: number; qty: number; status: string; endTime: string; condition: string }

async function sellerList(seller: string, from: Date, to: Date, maxPages = 3) {
  const rows: Row[] = []
  let total = 0
  let error: string | null = null
  for (let page = 1; page <= maxPages; page++) {
    const r = await tradingCall(
      "GetSellerList",
      `<UserID>${seller}</UserID>
  <EndTimeFrom>${from.toISOString()}</EndTimeFrom>
  <EndTimeTo>${to.toISOString()}</EndTimeTo>
  <IncludeWatchCount>true</IncludeWatchCount>
  <DetailLevel>ReturnAll</DetailLevel>
  <Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination>`
    )
    if (!r.ok) { error = r.error; break }
    const $ = r.$
    total = parseInt($("PaginationResult > TotalNumberOfEntries").text()) || total
    $("ItemArray > Item").each((_, el) => {
      const it = $(el)
      const price = it.find("SellingStatus > CurrentPrice").first()
      rows.push({
        itemId: it.children("ItemID").text(),
        title: it.children("Title").text(),
        price: price.text(),
        currency: price.attr("currencyID") ?? "",
        qtySold: parseInt(it.find("SellingStatus > QuantitySold").first().text()) || 0,
        qty: parseInt(it.children("Quantity").text()) || 0,
        status: it.find("SellingStatus > ListingStatus").first().text(),
        endTime: it.find("ListingDetails > EndTime").first().text(),
        condition: it.children("ConditionDisplayName").text(),
      })
    })
    const pages = parseInt($("PaginationResult > TotalNumberOfPages").text()) || 1
    if (page >= pages) break
  }
  return { total, rows, error }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const item = (url.searchParams.get("item") ?? "").replace(/\D/g, "") || null
  if (item) {
    const r = await tradingCall("GetItem", `<ItemID>${item}</ItemID><DetailLevel>ReturnAll</DetailLevel>`)
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error })
    const $ = r.$
    return NextResponse.json({
      ok: true,
      itemId: item,
      title: $("Item > Title").first().text(),
      seller: $("Item > Seller > UserID").first().text(),
      status: $("SellingStatus > ListingStatus").first().text(),
      price: $("SellingStatus > CurrentPrice").first().text(),
      quantity: $("Item > Quantity").first().text(),
      quantitySold: $("SellingStatus > QuantitySold").first().text(),
      endTime: $("ListingDetails > EndTime").first().text(),
      location: $("Item > Country").first().text(),
    })
  }

  const seller = url.searchParams.get("seller") || "asatan_japan"
  const now = new Date()
  const day = 24 * 3600 * 1000
  const ended = await sellerList(seller, new Date(now.getTime() - 30 * day), now)
  const active = await sellerList(seller, now, new Date(now.getTime() + 40 * day))
  const pick = (rows: Row[]) =>
    rows.filter((r) => r.qtySold > 0).sort((a, b) => b.qtySold - a.qtySold || Number(b.price) - Number(a.price)).slice(0, 25)
  return NextResponse.json({
    ok: !ended.error && !active.error,
    seller,
    errors: { ended: ended.error, active: active.error },
    endedLast30Days: {
      total: ended.total,
      fetched: ended.rows.length,
      sold: ended.rows.filter((r) => r.qtySold > 0).length,
      unsold: ended.rows.filter((r) => r.qtySold === 0).length,
      soldSamples: pick(ended.rows),
    },
    activeNow: {
      total: active.total,
      fetched: active.rows.length,
      withSales: active.rows.filter((r) => r.qtySold > 0).length,
      soldSamples: pick(active.rows),
    },
  })
}
