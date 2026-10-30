import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as cheerio from "cheerio"
import { extractEbayItemId } from "@/lib/utils"
import { estimateEbayFeeUsd } from "@/lib/sales"

// eBayの売れた注文を読み取り、sales テーブルに「新しいものだけ」追加する。
// 出品には一切触れない（GetOrders は読み取り専用）。
export const dynamic = "force-dynamic"
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const num = (v: string | undefined) => {
  const n = parseFloat(v ?? "")
  return Number.isFinite(n) ? n : 0
}

async function getOrdersPage(token: string, from: Date, to: Date, page: number) {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <CreateTimeFrom>${from.toISOString()}</CreateTimeFrom>
  <CreateTimeTo>${to.toISOString()}</CreateTimeTo>
  <OrderRole>Seller</OrderRole>
  <OrderStatus>Completed</OrderStatus>
  <DetailLevel>ReturnAll</DetailLevel>
  <Pagination><EntriesPerPage>100</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination>
</GetOrdersRequest>`
  const res = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    cache: "no-store",
    headers: {
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "X-EBAY-API-CALL-NAME": "GetOrders",
      "X-EBAY-API-SITEID": "0",
      "Content-Type": "text/xml",
    },
    body,
  })
  return cheerio.load(await res.text(), { xmlMode: true })
}

async function fetchRate(): Promise<number> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" })
    const j = await r.json()
    const jpy = j?.rates?.JPY
    return typeof jpy === "number" ? Math.round(jpy * 100) / 100 : 150
  } catch {
    return 150
  }
}

export async function POST(req: Request) {
  const token = process.env.EBAY_USER_TOKEN
  if (!token) {
    return NextResponse.json({ ok: false, error: "VercelにEBAY_USER_TOKENが設定されていません" }, { status: 500 })
  }

  // 取り込む期間（日数）。eBayの上限に合わせて最大90日
  const url = new URL(req.url)
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") ?? "90") || 90, 1), 90)
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)

  const rate = await fetchRate()

  // 登録済み商品（ItemID → 仕入れ値など）
  const { data: items } = await supabase
    .from("procurement_settings")
    .select("ebay_url, purchase_price, discount_percent, discount_points, shipping_cost_jpy, customs_duty_jpy")
  const byItemId = new Map<string, NonNullable<typeof items>[number]>()
  for (const it of items ?? []) {
    const id = extractEbayItemId(it.ebay_url)
    if (id) byItemId.set(id, it)
  }

  const rows: Record<string, unknown>[] = []
  for (let page = 1; page <= 10; page++) {
    const $ = await getOrdersPage(token, from, to, page)
    const ack = $("GetOrdersResponse > Ack").text()
    if (ack !== "Success" && ack !== "Warning") {
      const msg = $("Errors > LongMessage").first().text() || "eBayからの応答がエラーでした"
      return NextResponse.json({ ok: false, error: msg }, { status: 502 })
    }

    $("OrderArray > Order").each((_, order) => {
      const o = $(order)
      const orderId = o.children("OrderID").text()
      const soldAt = o.children("PaidTime").text() || o.children("CreatedTime").text()
      const txs = o.find("TransactionArray > Transaction")
      // 送料は注文単位なので、1件目の明細に寄せる
      const shippingIncome = num(o.find("ShippingServiceSelected > ShippingServiceCost").first().text())

      txs.each((i, tx) => {
        const t = $(tx)
        const itemId = t.find("Item > ItemID").first().text()
        const qty = parseInt(t.children("QuantityPurchased").text()) || 1
        const saleUsd = num(t.children("TransactionPrice").text()) * qty
        const shipUsd = i === 0 ? shippingIncome : 0
        const feeText = t.children("FinalValueFee").text()
        const feeEstimated = feeText === ""
        const feeUsd = feeEstimated ? estimateEbayFeeUsd(saleUsd + shipUsd) : num(feeText)

        const it = byItemId.get(itemId)
        const purchase = it
          ? Math.round(num(String(it.purchase_price)) * (1 - num(String(it.discount_percent)) / 100) - num(String(it.discount_points)))
          : 0

        rows.push({
          line_item_id: t.children("OrderLineItemID").text() || `${orderId}-${itemId}-${i}`,
          order_id: orderId,
          item_id: itemId,
          title: t.find("Item > Title").first().text(),
          sold_at: soldAt || null,
          quantity: qty,
          sale_usd: saleUsd,
          shipping_income_usd: shipUsd,
          ebay_fee_usd: feeUsd,
          fee_estimated: feeEstimated,
          exchange_rate: rate,
          purchase_cost_jpy: purchase,
          shipping_cost_jpy: it ? num(String(it.shipping_cost_jpy)) : 0,
          other_cost_jpy: it ? num(String(it.customs_duty_jpy)) : 0,
        })
      })
    })

    if ($("HasMoreOrders").text() !== "true") break
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, found: 0, added: 0 })
  }

  // すでに取り込んだ明細は上書きしない（手で直した仕入れ値などを守る）
  const { data: added, error } = await supabase
    .from("sales")
    .upsert(rows, { onConflict: "line_item_id", ignoreDuplicates: true })
    .select("id")
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, found: rows.length, added: added?.length ?? 0 })
}
