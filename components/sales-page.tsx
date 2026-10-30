"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Download, Pencil, Receipt, Save, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { calcSale, PAYOUT_FEE_RATE, TAX_FILING_LINE_JPY, type SaleRow } from "@/lib/sales"

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`

// 日本時間での年
const jstYear = (iso: string | null) =>
  iso ? new Date(new Date(iso).getTime() + 9 * 3600 * 1000).getUTCFullYear() : null

const jstDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" })
    : "-"

type EditFields = Pick<SaleRow, "purchase_cost_jpy" | "shipping_cost_jpy" | "other_cost_jpy" | "exchange_rate" | "ebay_fee_usd">

export function SalesPage() {
  const [sales, setSales] = useState<SaleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<keyof EditFields, string>>({
    purchase_cost_jpy: "", shipping_cost_jpy: "", other_cost_jpy: "", exchange_rate: "", ebay_fee_usd: "",
  })

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from("sales").select("*").order("sold_at", { ascending: false })
    if (error) setLoadError(error.message)
    else { setLoadError(null); setSales((data ?? []) as SaleRow[]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleImport = async () => {
    setImporting(true)
    setImportMsg(null)
    try {
      const res = await fetch("/api/import-sales?days=90", { method: "POST" })
      const j = await res.json()
      if (j.ok) {
        const feePart = j.feeError
          ? `（手数料の実額は取れませんでした：${j.feeError}）`
          : `、手数料の実額を ${j.feeUpdated}件反映しました（明細${j.feeEntries}行）`
        setImportMsg(`直近90日の注文 ${j.found}件を確認、新しく ${j.added}件を追加${feePart}`)
      } else {
        setImportMsg(`取り込み失敗：${j.error}`)
      }
      if (j.ok) await load()
    } catch {
      setImportMsg("取り込み失敗：通信エラー")
    }
    setImporting(false)
  }

  const years = useMemo(() => {
    const ys = new Set<number>([new Date().getFullYear()])
    sales.forEach((s) => { const y = jstYear(s.sold_at); if (y) ys.add(y) })
    return [...ys].sort((a, b) => b - a)
  }, [sales])

  const yearSales = sales.filter((s) => jstYear(s.sold_at) === year)
  const totals = yearSales.reduce(
    (acc, s) => {
      const c = calcSale(s)
      acc.gross += c.grossJpy
      acc.profit += c.profitJpy
      return acc
    },
    { gross: 0, profit: 0 }
  )
  const linePct = Math.min(Math.max((totals.profit / TAX_FILING_LINE_JPY) * 100, 0), 100)
  const overLine = totals.profit > TAX_FILING_LINE_JPY

  const startEdit = (s: SaleRow) => {
    setEditingId(s.id)
    setDraft({
      purchase_cost_jpy: String(s.purchase_cost_jpy),
      shipping_cost_jpy: String(s.shipping_cost_jpy),
      other_cost_jpy: String(s.other_cost_jpy),
      exchange_rate: String(s.exchange_rate),
      ebay_fee_usd: String(s.ebay_fee_usd),
    })
  }

  const saveEdit = async (s: SaleRow) => {
    const patch: Partial<SaleRow> = {
      purchase_cost_jpy: parseFloat(draft.purchase_cost_jpy) || 0,
      shipping_cost_jpy: parseFloat(draft.shipping_cost_jpy) || 0,
      other_cost_jpy: parseFloat(draft.other_cost_jpy) || 0,
      exchange_rate: parseFloat(draft.exchange_rate) || s.exchange_rate,
      ebay_fee_usd: parseFloat(draft.ebay_fee_usd) || 0,
    }
    if (patch.ebay_fee_usd !== Number(s.ebay_fee_usd)) patch.fee_estimated = false
    const { error } = await supabase.from("sales").update(patch).eq("id", s.id)
    if (error) { alert(`保存できませんでした：${error.message}`); return }
    setEditingId(null)
    await load()
  }

  const field = (key: keyof EditFields, label: string) => (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        value={draft[key]}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        className="h-9"
      />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">売上・利益</h1>
            <p className="text-sm text-muted-foreground">eBayで売れた注文の記録</p>
          </div>
        </div>
        <Button onClick={handleImport} disabled={importing} className="gap-2">
          <Download className="h-4 w-4" />
          {importing ? "取り込み中…" : "eBayから取り込む"}
        </Button>
      </div>

      {importMsg && <p className="text-sm rounded-md border bg-muted/40 px-3 py-2">{importMsg}</p>}
      {loadError && (
        <p className="text-sm rounded-md border border-destructive/50 text-destructive px-3 py-2">
          読み込みエラー：{loadError}（salesテーブルが未作成の可能性があります）
        </p>
      )}

      {/* 年の切り替え */}
      <div className="flex gap-2 flex-wrap">
        {years.map((y) => (
          <Button key={y} size="sm" variant={y === year ? "default" : "outline"} onClick={() => setYear(y)}>
            {y}年
          </Button>
        ))}
      </div>

      {/* 年間サマリー */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">件数</p>
          <p className="text-lg font-semibold">{yearSales.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">売上</p>
          <p className="text-lg font-semibold">{yen(totals.gross)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">利益</p>
          <p className={`text-lg font-semibold ${totals.profit < 0 ? "text-destructive" : ""}`}>{yen(totals.profit)}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span>年20万円ライン</span>
          <span className={overLine ? "text-destructive font-semibold" : "text-muted-foreground"}>
            {overLine ? `${yen(totals.profit - TAX_FILING_LINE_JPY)} 超過` : `残り ${yen(TAX_FILING_LINE_JPY - Math.max(totals.profit, 0))}`}
          </span>
        </div>
        <Progress value={linePct} />
        <p className="text-xs text-muted-foreground">
          目安です。利益が年20万円を超えると所得税の確定申告が必要になります（住民税の申告は金額にかかわらず別途必要）。
          売れ残り在庫の仕入れ値や梱包材などは、ここには含まれていません。
        </p>
      </div>

      {/* 一覧 */}
      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : yearSales.length === 0 ? (
        <p className="text-sm text-muted-foreground">この年の記録はまだありません。「eBayから取り込む」を押してください。</p>
      ) : (
        <div className="space-y-3">
          {yearSales.map((s) => {
            const c = calcSale(s)
            const editing = editingId === s.id
            const noCost = Number(s.purchase_cost_jpy) === 0
            return (
              <div key={s.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {jstDate(s.sold_at)}
                      {s.item_id && (
                        <>
                          {" · "}
                          <a href={`https://www.ebay.com/itm/${s.item_id}`} target="_blank" rel="noreferrer" className="underline">
                            {s.item_id}
                          </a>
                        </>
                      )}
                    </p>
                    <p className="text-sm font-medium line-clamp-2">{s.title}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-base font-semibold ${c.profitJpy < 0 ? "text-destructive" : "text-emerald-600"}`}>
                      {c.profitJpy >= 0 ? "+" : ""}{yen(c.profitJpy)}
                    </p>
                    {noCost && <Badge variant="outline" className="text-[10px]">仕入れ値 未入力</Badge>}
                  </div>
                </div>

                {!editing ? (
                  <div className="flex items-end justify-between gap-3">
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>
                        売値 ${Number(s.sale_usd).toFixed(2)}
                        {Number(s.shipping_income_usd) > 0 && ` + 送料 $${Number(s.shipping_income_usd).toFixed(2)}`}
                        {` ・ 為替 ¥${s.exchange_rate}`}
                      </p>
                      <p>
                        eBay手数料 ${Number(s.ebay_fee_usd).toFixed(2)}{s.fee_estimated && "（推定）"}
                        {` ・ 受取手数料 $${c.payoutFeeUsd.toFixed(2)}`}
                      </p>
                      <p>
                        仕入れ {yen(Number(s.purchase_cost_jpy))} ・ 国際送料 {yen(Number(s.shipping_cost_jpy))}
                        {Number(s.other_cost_jpy) > 0 && ` ・ その他 ${yen(Number(s.other_cost_jpy))}`}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1 shrink-0" onClick={() => startEdit(s)}>
                      <Pencil className="h-3.5 w-3.5" />直す
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {field("purchase_cost_jpy", "仕入れ値（円）")}
                      {field("shipping_cost_jpy", "国際送料（円）")}
                      {field("other_cost_jpy", "その他（円）")}
                      {field("exchange_rate", "為替（円/ドル）")}
                      {field("ebay_fee_usd", "eBay手数料（ドル）")}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="gap-1" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />やめる
                      </Button>
                      <Button size="sm" className="gap-1" onClick={() => saveEdit(s)}>
                        <Save className="h-3.5 w-3.5" />保存
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        利益 =（売値 + 送料 − eBay手数料 − 受取手数料{(PAYOUT_FEE_RATE * 100).toFixed(0)}%）× 為替 − 仕入れ値 − 国際送料 − その他
      </p>
    </div>
  )
}
