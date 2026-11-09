import { NextResponse } from "next/server"
import { browseSearch } from "@/lib/ebay-browse"

// 試作：seller参考の56人が今も活動しているかを判定する（読み取りのみ）
export const dynamic = "force-dynamic"
export const maxDuration = 60

const SELLERS = ["asatan_japan","grand-base-japan","hibiki_01_japan","yukiman3003","kamatari-com","88.japan.seller","haruka_japan","ponta-masa0328","spice-japan","jpwstore.2020","love-of-japan","bapojapan","enishi02","akindo24_jp","honeybeehunters","mamyu0605","kahahirako-japan","dao_onnut","omotenashi3054","tokyotune","ko_rare_finds","hidecky7","japan-net-shop","merikai_jp","applecrown","tn.japanese-store","japandesignlove","toshiiio0416","souickoba_0","hobby_and_toys_japan","365-shop-japan","moshimoshistore_mikiya","happy-goods-japan","japan-samurai-888","unique_japanese_shop","sakuraya.77","nodotake_japan","tokyocat3","spring_sky","culture_japan_hikari","sotka29","daiki.japan","dr_nine","essence_japan","h.s.works2525","sorishoper","uptail-shop","horizonharborshop","nokar-77","m34japan","infinity_japan","zatta.japan","unagiiseel","k_k.japan","tomoook-8","eichan0420"]

// タイトルに日本を示す語が入っている出品で数える（Browse API は検索語かカテゴリが必須のため）
const Q = "(japan, jpn, jp, japanese)"

async function check(seller: string) {
  const base = [`sellers:{${seller}}`, "price:[150..400]", "priceCurrency:USD"]
  const all = await browseSearch({ q: Q, limit: "50", sort: "newlyListed" }, base)
  if (!all.ok) return { seller, error: all.error }
  const used = await browseSearch({ q: Q, limit: "1" }, [...base, "conditions:{USED}"])
  const newest = all.items.map((i) => i.created).filter(Boolean).sort().pop() ?? null
  const since30 = Date.now() - 30 * 24 * 3600 * 1000
  const new30 = all.items.filter((i) => i.created && Date.parse(i.created) > since30).length
  return {
    seller,
    listings150to400: all.total,
    used150to400: used.total,
    newestListing: newest ? newest.slice(0, 10) : null,
    listedLast30d: new30 >= 50 ? "50+" : new30,
  }
}

export async function GET() {
  const results: Record<string, unknown>[] = []
  for (let i = 0; i < SELLERS.length; i += 8) {
    results.push(...(await Promise.all(SELLERS.slice(i, i + 8).map(check))))
  }
  const alive = results.filter((r) => typeof r.listedLast30d !== "undefined" && r.listedLast30d !== 0)
  return NextResponse.json({
    checked: results.length,
    activeLast30d: alive.length,
    withUsed: results.filter((r) => Number(r.used150to400) > 0).length,
    results: results.sort((a, b) => Number(b.used150to400 ?? -1) - Number(a.used150to400 ?? -1)),
  })
}
