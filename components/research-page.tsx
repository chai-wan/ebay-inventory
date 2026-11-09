"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, Play, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { maxPurchaseJpy, type PricingSettings } from "@/lib/pricing"

interface Candidate {
  model: string
  listings: number
  sellers: number
  total_sold: number
  monthly_est: number
  median_price: number
  min_price: number
  max_price: number
  sample_title: string
  top_item_id: string
  active_listings: number
}

const ASSUMED_SHIPPING_JPY = 3000 // 軽い小物を想定した送料（SpeedPAK・燃料込みの目安）
const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`

export function ResearchPage({ exchangeRate, pricing }: { exchangeRate: number; pricing: PricingSettings }) {
  const [rows, setRows] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [minSold, setMinSold] = useState(2)
  const [q, setQ] = useState("")
  const [stats, setStats] = useState<{ items: number; checked: number; sold: number; sources: string } | null>(null)
  const [last, setLast] = useState<{ at: string; log: string[] } | null>(null)
  const [running, setRunning] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from("research_candidates")
      .select("*")
      .gte("total_sold", minSold)
      .order("monthly_est", { ascending: false })
      .limit(150)
    setRows((data ?? []) as Candidate[])
    const [{ count: items }, { count: checked }, { count: sold }, { data: src }, { data: lastRow }] = await Promise.all([
      supabase.from("research_items").select("item_id", { count: "exact", head: true }),
      supabase.from("research_items").select("item_id", { count: "exact", head: true }).not("last_checked", "is", null),
      supabase.from("research_items").select("item_id", { count: "exact", head: true }).eq("sold_confirmed", true),
      supabase.from("research_sources").select("last_run_at").eq("enabled", true),
      supabase.from("app_tokens").select("value").eq("name", "research_last").maybeSingle(),
    ])
    const doneSrc = (src ?? []).filter((s) => s.last_run_at).length
    setStats({ items: items ?? 0, checked: checked ?? 0, sold: sold ?? 0, sources: `${doneSrc}/${(src ?? []).length}` })
    try { setLast(lastRow?.value ? JSON.parse(lastRow.value) : null) } catch { setLast(null) }
    setLoading(false)
  }

  useEffect(() => { load() }, [minSold]) // eslint-disable-line react-hooks/exhaustive-deps

  const runNow = async () => {
    setRunning(true)
    await fetch("/api/research/step", { method: "POST" }).catch(() => null)
    setRunning(false)
    await load()
  }

  const shown = rows.filter((r) => !q || r.model.includes(q.toUpperCase()) || r.sample_title.toUpperCase().includes(q.toUpperCase()))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">リサーチ</h1>
        <p className="text-sm text-muted-foreground">
          日本から発送・${150}〜${400}の出品を毎日記録し、繰り返し売れている型番を並べます（15分ごとに自動で少しずつ進みます）。
        </p>
      </div>

      <div className="rounded-lg border bg-card p-3 text-xs text-muted-foreground space-y-1">
        {stats && (
          <p>
            記録した出品 {stats.items.toLocaleString()}件 ・ 売れた数を調べた {stats.checked.toLocaleString()}件 ・ 売れて終わった出品 {stats.sold.toLocaleString()}件 ・ 一周した対象 {stats.sources}
          </p>
        )}
        {last && (
          <p>
            最後の処理：{new Date(last.at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            （{last.log.slice(-2).join(" / ") || "処理なし"}）
          </p>
        )}
        <Button size="sm" variant="outline" className="gap-1 mt-1" onClick={runNow} disabled={running}>
          <Play className="h-3.5 w-3.5" />
          {running ? "処理中…（約45秒）" : "今すぐ1回進める"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="型番・商品名で絞り込み" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {[1, 2, 5].map((n) => (
          <Button key={n} size="sm" variant={minSold === n ? "default" : "outline"} onClick={() => setMinSold(n)}>
            {n}個以上売れた
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        仕入れ上限＝利益¥{pricing.targetProfitJpy.toLocaleString()}を残せる仕入れ値（売値の中央値、送料¥{ASSUMED_SHIPPING_JPY.toLocaleString()}と仮定、為替¥{exchangeRate}、「計算の設定」の手数料・関税で計算）。
        型番はタイトルから自動で抜き出しているので、別の商品が混ざることがあります。
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">まだ候補がありません。データがたまるまで数日かかります。</p>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => {
            const cap = maxPurchaseJpy(Number(r.median_price), exchangeRate, ASSUMED_SHIPPING_JPY, pricing.targetProfitJpy, pricing)
            const kw = encodeURIComponent(r.model)
            return (
              <div key={r.model} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{r.model}</p>
                    <a
                      href={`https://www.ebay.com/itm/${r.top_item_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground underline line-clamp-2"
                    >
                      {r.sample_title}
                    </a>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">月 約{Number(r.monthly_est).toFixed(1)}個</p>
                    <p className="text-xs text-muted-foreground">累計 {r.total_sold}個</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>売値 中央${Number(r.median_price).toFixed(0)}（${Number(r.min_price).toFixed(0)}〜${Number(r.max_price).toFixed(0)}）</span>
                  <span>出品中 {r.active_listings}件 ・ セラー {r.sellers}人</span>
                  <Badge variant={cap > 0 ? "secondary" : "destructive"} className="text-[11px]">
                    仕入れ上限 {cap > 0 ? yen(cap) : "利益が出ない"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  <a className="inline-flex items-center gap-1 text-primary underline" target="_blank" rel="noreferrer"
                    href={`https://jp.mercari.com/search?keyword=${kw}&status=sold_out`}>
                    メルカリ 売り切れ <ExternalLink className="h-3 w-3" />
                  </a>
                  <a className="inline-flex items-center gap-1 text-primary underline" target="_blank" rel="noreferrer"
                    href={`https://jp.mercari.com/search?keyword=${kw}&status=on_sale&sort=price&order=asc`}>
                    メルカリ 販売中 <ExternalLink className="h-3 w-3" />
                  </a>
                  <a className="inline-flex items-center gap-1 text-primary underline" target="_blank" rel="noreferrer"
                    href={`https://auctions.yahoo.co.jp/closedsearch/closedsearch?p=${kw}`}>
                    ヤフオク 落札 <ExternalLink className="h-3 w-3" />
                  </a>
                  <a className="inline-flex items-center gap-1 text-primary underline" target="_blank" rel="noreferrer"
                    href={`https://www.ebay.com/sch/i.html?_nkw=${kw}&LH_Sold=1&LH_Complete=1`}>
                    eBay 落札 <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
