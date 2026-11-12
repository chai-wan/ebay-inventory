import type { NextRequest } from "next/server"
import { serverSupabase } from "@/lib/supabase-server"
import { getAccessToken } from "@/lib/ebay-oauth"
import { tradingCall } from "@/lib/ebay-trading"

// 台帳の払出しの空欄を、eBayの売上記録（Finances API の SALE）で埋める。
// ?from=YYYY-MM-DD から今日まで。既定は下見だけ（何も書かない）。?apply=1 のときだけ書き込む。
// 対象：同じItem numberで払出しが空の受入れ行（古い順）。すでに台帳に記入済みの注文は飛ばす。
export const dynamic = "force-dynamic"
export const maxDuration = 60

const num = (v: unknown) => (v == null || v === "" ? 0 : Number(v))

type Sale = { title?: string; itemId: string; orderId: string; lineItemId: string; date: string; priceUsd: number; amountUsd: number; buyer: string }

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") ?? "2026-02-01"
  const apply = req.nextUrl.searchParams.get("apply") === "1"
  const access = await getAccessToken()
  if (!access) return Response.json({ ok: false, error: "eBay未連携" }, { status: 400 })

  const sales: Sale[] = []
  let sample: unknown = null
  const range = `[${new Date(`${from}T00:00:00+09:00`).toISOString()}..${new Date().toISOString()}]`
  for (let offset = 0; offset < 5000; offset += 200) {
    const q = new URLSearchParams({ limit: "200", offset: String(offset) })
    q.append("filter", "transactionType:{SALE}")
    q.append("filter", `transactionDate:${range}`)
    const r = await fetch(`https://apiz.ebay.com/sell/finances/v1/transaction?${q.toString()}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${access}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
    })
    const j = await r.json()
    if (!r.ok) return Response.json({ ok: false, error: j?.errors?.[0]?.message || `Finances API ${r.status}` }, { status: 502 })
    for (const t of j.transactions ?? []) {
      if (!sample) sample = t
      const refs: { referenceId?: string; referenceType?: string }[] = t.references ?? []
      const itemRef = refs.find((x) => x.referenceType === "ITEM_ID")?.referenceId ?? ""
      const lines: { lineItemId?: string; feeBasisAmount?: { value?: string } }[] = t.orderLineItems ?? []
      for (const li of lines.length ? lines : [{}]) {
        sales.push({
          itemId: String(itemRef),
          orderId: String(t.orderId ?? ""),
          lineItemId: String(li.lineItemId ?? ""),
          date: new Date(new Date(t.transactionDate).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10),
          priceUsd: num(li.feeBasisAmount?.value ?? t.totalFeeBasisAmount?.value),
          amountUsd: num(t.amount?.value),
          buyer: String(t.buyer?.username ?? ""),
        })
      }
    }
    if (!j.next) break
  }
  sales.sort((a, b) => a.date.localeCompare(b.date))

  // Finances にはItem numberが載らないので、注文番号から Trading API の GetOrders で引く
  const needOrders = [...new Set(sales.filter((x) => !x.itemId && x.orderId).map((x) => x.orderId))]
  const byOrder = new Map<string, { itemId: string; txId: string; title: string }[]>()
  let lookupError: string | null = null
  for (let i = 0; i < needOrders.length; i += 20) {
    const ids = needOrders.slice(i, i + 20).map((o) => `<OrderID>${o}</OrderID>`).join("")
    const r = await tradingCall("GetOrders", `<OrderIDArray>${ids}</OrderIDArray><OrderRole>Seller</OrderRole><DetailLevel>ReturnAll</DetailLevel>`)
    if (!r.ok) { lookupError = r.error; break }
    r.$("OrderArray > Order").each((_, o) => {
      const $o = r.$(o)
      const ids2 = [$o.children("OrderID").text(), $o.children("ExtendedOrderID").text()].filter(Boolean)
      const txs: { itemId: string; txId: string; title: string }[] = []
      $o.find("TransactionArray > Transaction").each((__, t) => {
        const $t = r.$(t)
        txs.push({ itemId: $t.find("Item > ItemID").first().text(), txId: $t.children("TransactionID").text(), title: $t.find("Item > Title").first().text() })
      })
      for (const id of ids2) byOrder.set(id, txs)
    })
  }
  for (const x of sales) {
    if (x.itemId) continue
    const txs = byOrder.get(x.orderId) ?? []
    const hit = txs.length === 1 ? txs[0] : txs.find((t) => t.txId === x.lineItemId)
    if (hit) { x.itemId = hit.itemId; x.title = hit.title }
  }

  const supabase = serverSupabase()
  const { data: open } = await supabase
    .from("kobutsu_ledger")
    .select("id, item_number, name, buy_date, out_confirm_id")
    .is("out_date", null)
    .eq("kubetsu", "買受")
    .order("buy_date", { ascending: true })
  const { data: done } = await supabase.from("kobutsu_ledger").select("out_confirm_id, item_number, out_date").not("out_date", "is", null)
  const doneOrders = new Set((done ?? []).map((d) => d.out_confirm_id).filter(Boolean))
  // Excelから入れた行は注文番号がないので、同じItem numberで売却日が前後3日以内の行があれば記入済みとみなす
  const nearDone = (s: Sale) =>
    (done ?? []).some((d) => d.item_number === s.itemId && Math.abs(new Date(d.out_date).getTime() - new Date(s.date).getTime()) <= 3 * 86400000)
  const used = new Set<number>()

  const plan: { ledgerId: number | null; name: string | null; sale: Sale; note: string }[] = []
  for (const s of sales) {
    if ((s.orderId && doneOrders.has(s.orderId)) || nearDone(s)) { plan.push({ ledgerId: null, name: null, sale: s, note: "記入済み" }); continue }
    const row = (open ?? []).find((o) => o.item_number && o.item_number === s.itemId && !used.has(o.id))
    if (!row) { plan.push({ ledgerId: null, name: null, sale: s, note: "台帳に該当なし" }); continue }
    used.add(row.id)
    plan.push({ ledgerId: row.id, name: row.name, sale: s, note: apply ? "記入" : "記入予定" })
    if (apply) {
      await supabase
        .from("kobutsu_ledger")
        .update({
          out_date: s.date, out_kubun: "売却", out_price: s.priceUsd, out_unit: "$", buyer_site: "ebay",
          out_confirm_id: s.orderId, buyer_id: s.buyer,
        })
        .eq("id", row.id)
        .is("out_date", null)
    }
  }
  return Response.json({ ok: true, from, apply, sales: sales.length, lookupError, plan, sample })
}
