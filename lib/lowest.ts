import { createClient } from "@supabase/supabase-js"
import { browseSearch } from "@/lib/ebay-browse"
import { extractModel } from "@/lib/model"
import { extractEbayItemId } from "@/lib/utils"

// 在庫の最安値チェック：検索語でeBay（米国向け・即決）を安い順に調べ、
// 自分以外の一番安い出品（本体価格＋送料）を procurement_settings に記録する。読み取りのみ。
// リサーチの15分ごとの処理から呼ばれ、1回に数件ずつ、各商品は約20時間に1回。

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const OWN_SELLER = "kaikaido-japan"
const PER_STEP = 6
const EVERY_HOURS = 20
// 部品取り・付属品だけ、などは比べ物にならないので除く
const NOT_SAME = /\b(for parts|parts only|not working|junk|broken|as[- ]is|case only|box only|manual only|empty box|replacement|cover only|cable only)\b/i

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "")

export async function checkLowest(log: string[]) {
  const due = new Date(Date.now() - EVERY_HOURS * 3600 * 1000).toISOString()
  const { data: rows, error } = await supabase
    .from("procurement_settings")
    .select("id, ebay_url, search_keyword, lowest_checked_at")
    .neq("search_keyword", "")
    .or(`lowest_checked_at.is.null,lowest_checked_at.lt.${due}`)
    .order("lowest_checked_at", { ascending: true, nullsFirst: true })
    .limit(PER_STEP)
  if (error) throw new Error(error.message)
  let done = 0
  for (const row of rows ?? []) {
    const kw = String(row.search_keyword).trim()
    const ownId = extractEbayItemId(row.ebay_url) || ""
    const r = await browseSearch(
      { q: kw, sort: "price", limit: "50" },
      ["buyingOptions:{FIXED_PRICE}", "deliveryCountry:US", "priceCurrency:USD"]
    )
    if (!r.ok) {
      log.push(`最安値：「${kw}」でエラー（${r.error}）`)
      continue
    }
    // 型番がある検索語なら、タイトルに型番が入っているものだけを同じ商品とみなす
    const model = extractModel(kw)
    const cands = r.items
      .filter((it) => it.seller !== OWN_SELLER && it.itemId !== ownId)
      .filter((it) => !NOT_SAME.test(it.title))
      .filter((it) => !model || norm(it.title).includes(norm(model)))
      .map((it) => ({ ...it, total: it.price + (it.shipping ?? 0) }))
      .sort((a, b) => a.total - b.total)
    const best = cands[0]
    await supabase
      .from("procurement_settings")
      .update({
        lowest_total_usd: best ? best.total : null,
        lowest_price_usd: best ? best.price : null,
        lowest_ship_usd: best ? best.shipping : null,
        lowest_url: best ? best.url || `https://www.ebay.com/itm/${best.itemId}` : null,
        lowest_title: best ? best.title : null,
        lowest_count: cands.length,
        lowest_checked_at: new Date().toISOString(),
      })
      .eq("id", row.id)
    done++
  }
  if (done) log.push(`最安値チェック ${done}件`)
}
