"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { BookOpen, FileDown, Pencil, Plus, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { LEDGER_COLUMNS, type LedgerField, type LedgerRow } from "@/lib/ledger"

// 古物台帳。Excelの「古物台帳」シートと同じ25列。行は削除できない（DB側で止めている）。
// 仕入れ登録で受入れ行が自動で入り、売上の取り込みで払出し欄が自動で埋まる。

const fmtPrice = (r: LedgerRow) => (r.price_jpy == null ? "-" : `¥${Number(r.price_jpy).toLocaleString()}`)
const fmtOut = (r: LedgerRow) => {
  if (r.out_price == null) return ""
  const unit = r.out_unit || ""
  return unit === "$" ? `$${Number(r.out_price).toFixed(2)}` : `${Number(r.out_price).toLocaleString()}${unit || "円"}`
}

type Draft = Record<LedgerField, string>
const emptyDraft = (): Draft => {
  const d = {} as Draft
  for (const c of LEDGER_COLUMNS) d[c.key] = ""
  d.kubetsu = "買受"
  d.out_kubun = "売却"
  d.qty = "1"
  d.buy_date = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  return d
}
const toDraft = (r: LedgerRow): Draft => {
  const d = {} as Draft
  for (const c of LEDGER_COLUMNS) d[c.key] = r[c.key] == null ? "" : String(r[c.key])
  return d
}
const fromDraft = (d: Draft) => {
  const out: Record<string, string | number | null> = {}
  for (const c of LEDGER_COLUMNS) {
    const v = d[c.key].trim()
    if (c.kind === "date") out[c.key] = v || null
    else if (c.kind === "number") out[c.key] = v === "" ? (c.key === "qty" ? 1 : null) : Number(v.replace(/[,$¥＄]/g, ""))
    else out[c.key] = v
  }
  return out
}

export function LedgerPage() {
  const [rows, setRows] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [onlyStock, setOnlyStock] = useState(false)
  const [editing, setEditing] = useState<LedgerRow | "new" | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = async () => {
    setLoading(true)
    const all: LedgerRow[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("kobutsu_ledger")
        .select("*")
        .order("buy_date", { ascending: false, nullsFirst: true })
        .order("id", { ascending: false })
        .range(from, from + 999)
      if (error) { setError(error.message); setLoading(false); return }
      all.push(...((data ?? []) as LedgerRow[]))
      if (!data || data.length < 1000) break
    }
    setError(null)
    setRows(all)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (onlyStock && r.out_date) return false
      if (!q) return true
      return [r.name, r.item_number, r.source, r.note1, r.hinmoku].some((v) => (v ?? "").toLowerCase().includes(q))
    })
  }, [rows, query, onlyStock])

  const stockCount = rows.filter((r) => !r.out_date).length

  const openEdit = (r: LedgerRow | "new") => {
    setSaveError(null)
    setDraft(r === "new" ? emptyDraft() : toDraft(r))
    setEditing(r)
  }

  const save = async () => {
    if (!editing) return
    setSaving(true)
    setSaveError(null)
    const body = fromDraft(draft)
    const { error } =
      editing === "new"
        ? await supabase.from("kobutsu_ledger").insert([{ ...body, origin: "manual" }])
        : await supabase.from("kobutsu_ledger").update(body).eq("id", editing.id)
    setSaving(false)
    if (error) { setSaveError(error.message); return }
    setEditing(null)
    await load()
  }

  const exportExcel = async () => {
    setExporting(true)
    try {
      const res = await fetch("/api/ledger/export")
      if (!res.ok) throw new Error(`保存に失敗しました（${res.status}）`)
      const blob = await res.blob()
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "kobutsu-ledger.xlsx"
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setExporting(false)
    }
  }

  const field = (key: LedgerField) => {
    const c = LEDGER_COLUMNS.find((x) => x.key === key)!
    return (
      <div key={key} className={`space-y-1 ${key === "name" || key.endsWith("address") || key === "note1" ? "col-span-2" : ""}`}>
        <Label htmlFor={`lg-${key}`} className="text-xs">{c.label}</Label>
        <Input
          id={`lg-${key}`}
          type={c.kind === "date" ? "date" : "text"}
          inputMode={c.kind === "number" ? "decimal" : undefined}
          value={draft[key]}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          <h2 className="text-lg font-semibold">古物台帳</h2>
          <span className="text-sm text-muted-foreground">{rows.length}件（在庫 {stockCount}件）</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={exporting}>
            <FileDown className="mr-1 h-4 w-4" />
            {exporting ? "作成中…" : "Excelで保存"}
          </Button>
          <Button size="sm" onClick={() => openEdit("new")}>
            <Plus className="mr-1 h-4 w-4" />
            行を追加
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        仕入れ設定で商品を登録すると受入れの行が自動で入り、売上を取り込むと払出しの欄が自動で埋まります。行は削除できません（3年間の保存のため）。
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="商品名・Item number・仕入れ先で検索" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} />
          在庫（払出しなし）だけ
        </label>
      </div>

      {error && <p className="text-sm text-red-700">読み込みエラー：{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => (
            <div key={r.id} className="rounded-lg border p-3 text-sm space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium leading-snug">{r.name || "（商品名なし）"}</div>
                <Button variant="ghost" size="sm" className="shrink-0 h-7 px-2" onClick={() => openEdit(r)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  直す
                </Button>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>受入 {r.buy_date ?? "-"}</span>
                <span className="font-semibold text-foreground">{fmtPrice(r)}</span>
                <span>{r.source || "-"}</span>
                {r.item_number && <span className="tabular-nums">#{r.item_number}</span>}
                {r.origin === "auto" && <span className="text-blue-700">自動</span>}
              </div>
              <div className="text-xs">
                {r.out_date ? (
                  <span className="text-emerald-700">
                    {r.out_kubun} {r.out_date} {fmtOut(r)} {r.buyer_site}
                  </span>
                ) : (
                  <span className="text-orange-700">在庫（払出しなし）</span>
                )}
              </div>
            </div>
          ))}
          {shown.length === 0 && <p className="text-sm text-muted-foreground">該当する行がありません。</p>}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "台帳に行を追加" : "台帳の行を直す"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold mb-2">受入れ</div>
              <div className="grid grid-cols-2 gap-2">
                {LEDGER_COLUMNS.filter((c) => c.group === "受入れ").map((c) => field(c.key))}
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold mb-2">払出し</div>
              <div className="grid grid-cols-2 gap-2">
                {LEDGER_COLUMNS.filter((c) => c.group === "払出し").map((c) => field(c.key))}
              </div>
            </div>
            {saveError && <p className="text-sm text-red-700">保存エラー：{saveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>やめる</Button>
            <Button onClick={save} disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
