import { createClient } from "@supabase/supabase-js"
import { browseSearch } from "@/lib/ebay-browse"
import { tradingCall } from "@/lib/ebay-trading"

// 自分用テラピーク：日本のセラーとカテゴリの出品を記録し、売れた数を調べて貯める。
// 15分ごとに /api/research/step から呼ばれ、1回あたり約45秒の範囲で少しずつ進める。
// すべて読み取りのみ（eBayの出品は変えない）。

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const PRICE_MIN = 150
export const PRICE_MAX = 400
const OWN_SELLER = "kaikaido-japan"
const SELLER_QUERY = "(japan, jpn, jp, japanese)" // Browse API は検索語かカテゴリが必須
const SELLER_CAP = 5000 // セラー1人あたりの記録上限
const CATEGORY_CAP = 1000 // カテゴリは新しい順にこの件数まで
const PAGE = 200
const GETITEM_PER_STEP = 40 // 15分ごと×40件＝1日約3,840件（GetItemの上限は1日5,000件）
const RECHECK_DAYS = 3 // 出品中のものを調べ直す間隔

export { extractModel } from "@/lib/model"
import { extractModel } from "@/lib/model"

interface Source {
  id: number
  kind: "seller" | "category"
  value: string
  conditions: string
  last_run_at: string | null
  cursor_offset: number
  run_started_at: string | null
}

// 1) 出品の記録：今日まだ一周していない対象を、続きから読む
async function snapshot(deadline: number, log: string[]) {
  const dueBefore = new Date(Date.now() - 20 * 3600 * 1000).toISOString()
  const { data: sources } = await supabase
    .from("research_sources")
    .select("id, kind, value, conditions, last_run_at, cursor_offset, run_started_at")
    .eq("enabled", true)
    .or(`last_run_at.is.null,last_run_at.lt.${dueBefore}`)
    .order("cursor_offset", { ascending: false }) // 途中のものを優先
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(1)
  const src = (sources?.[0] ?? null) as Source | null
  if (!src) return false

  const runStarted = src.cursor_offset > 0 && src.run_started_at ? src.run_started_at : new Date().toISOString()
  if (src.cursor_offset === 0) {
    await supabase.from("research_sources").update({ run_started_at: runStarted }).eq("id", src.id)
  }

  const cap = src.kind === "seller" ? SELLER_CAP : CATEGORY_CAP
  const filters = ["itemLocationCountry:JP", `price:[${PRICE_MIN}..${PRICE_MAX}]`, "priceCurrency:USD"]
  if (src.conditions === "USED") filters.push("conditions:{USED}")
  const params: Record<string, string> = { limit: String(PAGE), sort: "newlyListed" }
  if (src.kind === "seller") {
    params.q = SELLER_QUERY
    filters.push(`sellers:{${src.value}}`)
  } else {
    params.category_ids = src.value
  }

  let offset = src.cursor_offset
  let done = false
  while (Date.now() < deadline - 8000) {
    const r = await browseSearch({ ...params, offset: String(offset) }, filters)
    if (!r.ok) {
      log.push(`検索エラー（${src.kind}:${src.value}）：${r.error}`)
      done = true
      break
    }
    const rows = r.items
      .filter((it) => it.itemId && it.seller !== OWN_SELLER)
      .map((it) => ({
        item_id: it.itemId,
        source_id: src.id,
        seller: it.seller,
        title: it.title,
        model: extractModel(it.title),
        price: it.price,
        condition: it.condition,
        last_seen: new Date().toISOString(),
        gone_since: null,
      }))
    if (rows.length) await supabase.from("research_items").upsert(rows, { onConflict: "item_id" })
    log.push(`記録 ${src.kind}:${src.value} ${offset}〜${offset + r.items.length}件（全${r.total}件）`)
    offset += PAGE
    if (r.items.length < PAGE || offset >= Math.min(r.total, cap)) {
      done = true
      break
    }
  }

  if (done) {
    await supabase
      .from("research_sources")
      .update({ last_run_at: runStarted, cursor_offset: 0 })
      .eq("id", src.id)
    // セラーは全件を見ているので、一周で出てこなかった出品は「消えた」とみなし、あとで個別に確かめる
    if (src.kind === "seller") {
      await supabase
        .from("research_items")
        .update({ gone_since: new Date().toISOString() })
        .eq("source_id", src.id)
        .lt("last_seen", runStarted)
        .is("gone_since", null)
        .eq("sold_confirmed", false)
        .or("listing_status.is.null,listing_status.eq.Active")
    }
  } else {
    await supabase.from("research_sources").update({ cursor_offset: offset }).eq("id", src.id)
  }
  return true
}

// 2) 1件ずつ調べる：未調査 → 消えたもの → 古くなったもの の順
async function pickForCheck(limit: number) {
  const ids: string[] = []
  const add = (rows: { item_id: string }[] | null) => {
    for (const r of rows ?? []) if (ids.length < limit && !ids.includes(r.item_id)) ids.push(r.item_id)
  }
  const { data: gone } = await supabase
    .from("research_items")
    .select("item_id")
    .not("gone_since", "is", null)
    .eq("sold_confirmed", false)
    .or("listing_status.is.null,listing_status.eq.Active")
    .limit(limit)
  add(gone)
  if (ids.length < limit) {
    const { data: fresh } = await supabase.from("research_items").select("item_id").is("last_checked", null).limit(limit)
    add(fresh)
  }
  if (ids.length < limit) {
    const stale = new Date(Date.now() - RECHECK_DAYS * 24 * 3600 * 1000).toISOString()
    const { data: old } = await supabase
      .from("research_items")
      .select("item_id")
      .eq("listing_status", "Active")
      .lt("last_checked", stale)
      .order("last_checked", { ascending: true })
      .limit(limit)
    add(old)
  }
  return ids
}

async function checkItem(itemId: string) {
  const r = await tradingCall("GetItem", `<ItemID>${itemId}</ItemID>`)
  const now = new Date().toISOString()
  if (!r.ok) {
    // 終わってから時間がたった出品などは取れない
    await supabase.from("research_items").update({ listing_status: "Unknown", last_checked: now }).eq("item_id", itemId)
    return "unknown"
  }
  const $ = r.$
  const status = $("SellingStatus > ListingStatus").first().text() || "Unknown"
  const qtySold = parseInt($("SellingStatus > QuantitySold").first().text()) || 0
  const update: Record<string, unknown> = {
    listing_status: status,
    quantity: parseInt($("Item > Quantity").first().text()) || null,
    quantity_sold: qtySold,
    start_time: $("ListingDetails > StartTime").first().text() || null,
    last_checked: now,
  }
  if (status === "Active") update.gone_since = null
  else update.sold_confirmed = qtySold > 0
  await supabase.from("research_items").update(update).eq("item_id", itemId)
  return status
}

async function checkItems(deadline: number, log: string[]) {
  const ids = await pickForCheck(GETITEM_PER_STEP)
  let n = 0
  let sold = 0
  for (let i = 0; i < ids.length && Date.now() < deadline - 3000; i += 4) {
    const res = await Promise.all(ids.slice(i, i + 4).map(checkItem))
    n += res.length
    sold += res.filter((s) => s === "Completed").length
  }
  if (n) log.push(`個別確認 ${n}件（終了していたもの ${sold}件）`)
}

export async function researchStep() {
  const started = Date.now()
  const deadline = started + 45_000
  const log: string[] = []
  try {
    await snapshot(started + 25_000, log) // 前半は記録、後半は個別確認
    await checkItems(deadline, log)
  } catch (e) {
    log.push(`エラー：${(e as Error).message}`)
  }
  const summary = { at: new Date().toISOString(), ms: Date.now() - started, log }
  await supabase
    .from("app_tokens")
    .upsert({ name: "research_last", value: JSON.stringify(summary), updated_at: summary.at })
  return summary
}
