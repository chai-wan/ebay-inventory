"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react"
import type { PricingSettings } from "@/lib/pricing"

// 利益計算の設定（ふだんは閉じておく）
export function PricingSettingsCard({ pricing, onSave }: { pricing: PricingSettings; onSave: (p: PricingSettings) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const start = () => {
    setDraft({
      ebayFeePct: String(pricing.ebayFeePct),
      payoutFeePct: String(pricing.payoutFeePct),
      fuelPct: String(pricing.fuelPct),
      dutyPct: String(pricing.dutyPct),
      targetProfitJpy: String(pricing.targetProfitJpy),
      zone: pricing.zone,
    })
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    const num = (k: string, d: number) => (Number.isFinite(parseFloat(draft[k])) ? parseFloat(draft[k]) : d)
    await onSave({
      ebayFeePct: num("ebayFeePct", pricing.ebayFeePct),
      payoutFeePct: num("payoutFeePct", pricing.payoutFeePct),
      fuelPct: num("fuelPct", pricing.fuelPct),
      dutyPct: num("dutyPct", pricing.dutyPct),
      targetProfitJpy: num("targetProfitJpy", pricing.targetProfitJpy),
      zone: draft.zone === "usw" ? "usw" : "use",
    })
    setSaving(false)
    setOpen(false)
  }

  const field = (key: string, label: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" inputMode="decimal" value={draft[key] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} />
    </div>
  )

  return (
    <div className="mb-4 rounded-lg border bg-card p-3 text-sm">
      <button type="button" className="flex w-full items-center justify-between" onClick={() => (open ? setOpen(false) : start())}>
        <span className="flex items-center gap-2 font-medium">
          <Settings2 className="h-4 w-4" />
          計算の設定
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          eBay手数料{pricing.ebayFeePct}%・燃料{pricing.fuelPct}%・関税{pricing.dutyPct}%・目標¥{pricing.targetProfitJpy.toLocaleString()}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {field("ebayFeePct", "eBay手数料の合計%")}
            {field("payoutFeePct", "受取手数料%")}
            {field("fuelPct", "FedEx燃料割増金%")}
            {field("dutyPct", "自分負担の関税%")}
            {field("targetProfitJpy", "目標利益（円）")}
            <div className="space-y-1">
              <Label className="text-xs">送料の地域</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2"
                value={draft.zone}
                onChange={(e) => setDraft((d) => ({ ...d, zone: e.target.value }))}
              >
                <option value="use">アメリカ東部・カナダ（高め）</option>
                <option value="usw">アメリカ西部</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            燃料割増金は毎週変わります。最近のSpeedPAKの請求書で「燃料割増金 ÷ 基本料金」を確認して入れてください。
            関税：日本→アメリカ（$2,500未満）はDDP発送が必須で、関税はセラー負担です。日本原産品は合計12.5%＋関税処理手数料で約13%（2026年7月時点）。原産国が日本以外の商品は率が変わります。
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>やめる</Button>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
