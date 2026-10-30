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

// eBayのアカウント明細（手数料の請求記録）を取り、明細ごとの手数料合計を返す。
// キーは「ItemID-TransactionID」と「ItemID」の2種類。USD以外の記録は使わない。
async function getAccountFees(token: string, from: Date, to: Date) {
  const byLine = new Map<string, number>()
  const byItem = new Map<string, number>()
  let entries = 0
  let error: string | null = null
  for (let page = 1; page <= 10; page++) {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<GetAccountRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  <AccountHistorySelection>BetweenSpecifiedDates</AccountHistorySelection>
  <BeginDate>${from.toISOString()}</BeginDate>
  <EndDate>${to.toISOString()}</EndDate>
  <Pagination><EntriesPerPage>2000</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination>
</GetAccountRequest>`
    const res = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      cache: "no-store",
      headers: {
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
        "X-EBAY-API-CALL-NAME": "GetAccount",
        "X-EBAY-API-SITEID": "0",
        "Content-Type": "text/xml",
      },
      body,
    })
    const $ = cheerio.load(await res.text(), { xmlMode: true })
    const ack = $("GetAccountResponse > Ack").text()
    if (ack !== "Success" && ack !== "Warning") {
      error = $("Errors > LongMessage").first().text() || "アカウント明細を取得できませんでした"
      break
    }
    $("AccountEntries > AccountEntry").each((_, e) => {
      const E = $(e)
      const type = E.children("AccountDetailsEntryType").text()
      const itemId = E.children("ItemID").text()
      const amt = E.children("GrossDetailAmount")
      if (!itemId || itemId === "0" || amt.attr("currencyID") !== "USD") return
      let v: number
      if (type.startsWith("Fee")) v = Math.abs(num(amt.text()))
      else if (type.startsWith("Credit")) v = -Math.abs(num(amt.text()))
      else return
      entries++
      const tx = E.children("TransactionID").text()
      if (tx && tx !== "0") byLine.set(`${itemId}-${tx}`, (byLine.get(`${itemId}-${tx}`) ?? 0) + v)
      byItem.set(itemId, (byItem.get(itemId) ?? 0) + v)
    })
    const total = parseInt($("PaginationResult > TotalNumberOfPages").text()) || 1
    if (page >= total) break
  }
  return { byLine, byItem, entries, error }
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

  // すでに取り込んだ明細は上書きしない（手で直した仕入れ値などを守る）
  let added = 0
  if (rows.length > 0) {
    const { data, error } = await supabase
      .from("sales")
      .upsert(rows, { onConflict: "line_item_id", ignoreDuplicates: true })
      .select("id")
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
    added = data?.length ?? 0
  }

  // 推定のままの手数料を、eBayのアカウント明細の実額に置き換える
  const fees = await getAccountFees(token, from, to)
  let feeUpdated = 0
  if (!fees.error) {
    const { data: pending } = await supabase
      .from("sales")
      .select("id, line_item_id, item_id")
      .eq("fee_estimated", true)
    const perItemCount = new Map<string, number>()
    for (const p of pending ?? []) perItemCount.set(p.item_id, (perItemCount.get(p.item_id) ?? 0) + 1)
    for (const p of pending ?? []) {
      let fee = fees.byLine.get(p.line_item_id)
      // 同じ商品が1回しか売れていなければ、商品単位の合計を使う
      if (fee === undefined && perItemCount.get(p.item_id) === 1) fee = fees.byItem.get(p.item_id)
      if (fee === undefined) continue
      const { error } = await supabase
        .from("sales")
        .update({ ebay_fee_usd: Math.round(fee * 100) / 100, fee_estimated: false })
        .eq("id", p.id)
      if (!error) feeUpdated++
    }
  }

  return NextResponse.json({
    ok: true,
    found: rows.length,
    added,
    feeUpdated,
    feeEntries: fees.entries,
    feeError: fees.error,
  })
}
