"use client"

import { keywordFromTitle } from "@/lib/model"
import { useState, useEffect } from "react"
import { calcSpeedpakFedexJpy } from "@/lib/shipping"
import { listingProfitJpy, requiredPriceUsd, type PricingSettings } from "@/lib/pricing"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { SiteMaster } from "./site-master"

// ProcurementSetting から inStockKeywords / outOfStockKeywords を削除
export interface ProcurementSetting {
  id: string
  siteName: string
  productUrl: string
  ebayUrl: string
  ebayReferenceUrl: string
  // eBay検索語（一覧の「安い順」リンク用）
  searchKeyword?: string
  ebayProductName: string
  monitoringInterval: string
  memo: string
  status: "monitoring" | "stopped" | "error"
  createdAt: Date
  // 仕入金額
  purchasePrice: number
  discountPercent: number
  discountPoints: number
  // 販売価格
  sellingPriceUsd: number
  shippingCostUsd: number
  shippingCostJpy: number
  customsDutyJpy: number

  // 梱包後の重さとサイズ（送料の自動計算用）
  weightKg?: number
  lengthCm?: number
  widthCm?: number
  heightCm?: number
  // メルカリ在庫監視（バッチが自動更新。フォームでは編集しない）
  mercariStatus?: string | null
  mercariCheckedAt?: Date | null
  ebayQuantity?: number | null
}

interface ProcurementSettingsFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (setting: Omit<ProcurementSetting, "id" | "createdAt" | "status">) => void
  editingSetting?: ProcurementSetting | null
  siteMasters: SiteMaster[]  // ← サイトマスタを外から受け取る
  exchangeRate: number
  pricing: PricingSettings
}

const INTERVAL_OPTIONS = [
  { value: "15", label: "15分" },
  { value: "30", label: "30分" },
  { value: "60", label: "1時間" },
  { value: "180", label: "3時間" },
  { value: "360", label: "6時間" },
  { value: "720", label: "12時間" },
  { value: "1440", label: "24時間" },
]

export function ProcurementSettingsForm({
  open,
  onOpenChange,
  onSubmit,
  editingSetting,
  siteMasters,
  exchangeRate,
  pricing,
}: ProcurementSettingsFormProps) {
  const [siteName, setSiteName] = useState("")
  const [productUrl, setProductUrl] = useState("")
  const [ebayUrl, setEbayUrl] = useState("")
  const [ebayReferenceUrl, setEbayReferenceUrl] = useState("")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [ebayProductName, setEbayProductName] = useState("")
  const [monitoringInterval, setMonitoringInterval] = useState("30")
  const [memo, setMemo] = useState("")
  // 仕入金額
  const [purchasePrice, setPurchasePrice] = useState(0)
  const [discountPercent, setDiscountPercent] = useState(0)
  const [discountPoints, setDiscountPoints] = useState(0)
  // 販売価格
  const [sellingPriceUsd, setSellingPriceUsd] = useState(0)
  const [shippingCostUsd, setShippingCostUsd] = useState(0)
  const [shippingCostJpy, setShippingCostJpy] = useState(0)
  const [customsDutyJpy, setCustomsDutyJpy] = useState(0)
  const [weightKg, setWeightKg] = useState(0)
  const [lengthCm, setLengthCm] = useState(0)
  const [widthCm, setWidthCm] = useState(0)
  const [heightCm, setHeightCm] = useState(0)

  // 仕入合計金額を計算
  const totalPurchasePrice = Math.round(
    purchasePrice * (1 - discountPercent / 100) - discountPoints
  )

  // 送料の自動計算（SpeedPAK FedEx・アメリカ向け）
  const ship = calcSpeedpakFedexJpy({
    weightKg, lengthCm, widthCm, heightCm, zone: pricing.zone, fuelPct: pricing.fuelPct,
  })
  const applyShip = (next: { w?: number; l?: number; wd?: number; h?: number }) => {
    const r = calcSpeedpakFedexJpy({
      weightKg: next.w ?? weightKg,
      lengthCm: next.l ?? lengthCm,
      widthCm: next.wd ?? widthCm,
      heightCm: next.h ?? heightCm,
      zone: pricing.zone,
      fuelPct: pricing.fuelPct,
    })
    if (r && !r.overMax) setShippingCostJpy(r.totalJpy)
  }
  const cost = { purchaseJpy: totalPurchasePrice, shippingJpy: shippingCostJpy, otherJpy: customsDutyJpy }
  const profitNow = sellingPriceUsd > 0 ? listingProfitJpy(sellingPriceUsd, shippingCostUsd, exchangeRate, cost, pricing) : null
  const needPrice = requiredPriceUsd(pricing.targetProfitJpy, shippingCostUsd, exchangeRate, cost, pricing)

  // 選択中サイトのキーワードをプレビュー表示
  const selectedSite = siteMasters.find((s) => s.siteName === siteName)

  useEffect(() => {
    if (editingSetting) {
      setSiteName(editingSetting.siteName)
      setProductUrl(editingSetting.productUrl)
      setEbayUrl(editingSetting.ebayUrl)
      setEbayReferenceUrl(editingSetting.ebayReferenceUrl)
      setSearchKeyword(editingSetting.searchKeyword ?? "")
      setEbayProductName(editingSetting.ebayProductName)
      setMonitoringInterval(editingSetting.monitoringInterval)
      setMemo(editingSetting.memo)
      setPurchasePrice(editingSetting.purchasePrice)
      setDiscountPercent(editingSetting.discountPercent)
      setDiscountPoints(editingSetting.discountPoints)
      setSellingPriceUsd(editingSetting.sellingPriceUsd)
      setShippingCostUsd(editingSetting.shippingCostUsd)
      setShippingCostJpy(editingSetting.shippingCostJpy)
      setCustomsDutyJpy(editingSetting.customsDutyJpy)
      setWeightKg(editingSetting.weightKg ?? 0)
      setLengthCm(editingSetting.lengthCm ?? 0)
      setWidthCm(editingSetting.widthCm ?? 0)
      setHeightCm(editingSetting.heightCm ?? 0)
    } else {
      resetForm()
    }
  }, [editingSetting, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      siteName,
      productUrl,
      ebayUrl,
      ebayReferenceUrl,
      searchKeyword,
      ebayProductName,
      monitoringInterval,
      memo,
      purchasePrice,
      discountPercent,
      discountPoints,
      sellingPriceUsd,
      shippingCostUsd,
      shippingCostJpy,
      customsDutyJpy,
      weightKg,
      lengthCm,
      widthCm,
      heightCm,
    })
    resetForm()
  }

  const resetForm = () => {
    setSiteName("")
    setProductUrl("")
    setEbayUrl("")
    setEbayReferenceUrl("")
    setSearchKeyword("")
    setEbayProductName("")
    setMonitoringInterval("30")
    setMemo("")
    setPurchasePrice(0)
    setDiscountPercent(0)
    setDiscountPoints(0)
    setSellingPriceUsd(0)
    setShippingCostUsd(0)
    setShippingCostJpy(0)
    setCustomsDutyJpy(0)
    setWeightKg(0)
    setLengthCm(0)
    setWidthCm(0)
    setHeightCm(0)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingSetting ? "設定を編集" : "新規仕入れ設定を追加"}
          </DialogTitle>
          <DialogDescription>
            商品ページの監視設定と価格情報を入力してください。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* 基本情報 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">基本情報</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="siteName">仕入元サイト</Label>
                <Select value={siteName} onValueChange={setSiteName} required>
                  <SelectTrigger id="siteName">
                    <SelectValue placeholder="サイトを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {siteMasters.map((site) => (
                      <SelectItem key={site.siteName} value={site.siteName}>
                        {site.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="monitoringInterval">監視間隔</Label>
                <Select value={monitoringInterval} onValueChange={setMonitoringInterval}>
                  <SelectTrigger id="monitoringInterval">
                    <SelectValue placeholder="監視間隔を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 選択サイトのキーワードプレビュー */}
            {selectedSite && (
              <div className="rounded-md bg-muted/50 border px-3 py-2 text-xs space-y-1">
                <div className="font-medium text-muted-foreground">
                  {selectedSite.displayName} の在庫監視キーワード（サイトマスタより）
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedSite.inStockKeywords && (
                    <span>
                      <span className="text-muted-foreground">在庫あり：</span>
                      <span className="text-emerald-700">{selectedSite.inStockKeywords}</span>
                    </span>
                  )}
                  {selectedSite.outOfStockKeywords && (
                    <span>
                      <span className="text-muted-foreground ml-2">在庫なし：</span>
                      <span className="text-red-700">{selectedSite.outOfStockKeywords}</span>
                    </span>
                  )}
                  {!selectedSite.inStockKeywords && !selectedSite.outOfStockKeywords && (
                    <span className="text-muted-foreground">キーワード未設定（サイトマスタで設定してください）</span>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="productUrl">仕入URL</Label>
              <Input
                id="productUrl"
                type="url"
                placeholder="https://jp.mercari.com/item/xxxxx"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                required={siteName !== "stock"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ebayProductName">eBay商品名</Label>
              <Input
                id="ebayProductName"
                type="text"
                placeholder="Toy Record Maker Kit Gakken Adult Science Magazine Book from Japan"
                value={ebayProductName}
                onChange={(e) => {
                  const next = e.target.value
                  // 検索語が空か、前の商品名から自動で入れたままなら、新しい商品名から作り直す
                  if (!searchKeyword.trim() || searchKeyword === keywordFromTitle(ebayProductName)) {
                    setSearchKeyword(keywordFromTitle(next))
                  }
                  setEbayProductName(next)
                }}
              />
              <p className="text-xs text-muted-foreground">eBayに登録した商品名を入力</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ebayUrl">eBay URL</Label>
              <Input
                id="ebayUrl"
                type="url"
                placeholder="https://www.ebay.com/itm/xxxxx"
                value={ebayUrl}
                onChange={(e) => setEbayUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">eBay出品ページのURLを入力（任意）</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ebayReferenceUrl">eBay参考URL</Label>
              <Input
                id="ebayReferenceUrl"
                type="url"
                placeholder="https://www.ebay.com/sch/xxxxx"
                value={ebayReferenceUrl}
                onChange={(e) => setEbayReferenceUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">参考にしたeBay商品ページのURLを入力（任意）</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="searchKeyword">eBay検索語</Label>
              <Input
                id="searchKeyword"
                placeholder="例：TASCAM DR-44WL"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">一覧の「安い順」リンクに使う言葉。商品名から自動で入ります（型番がないと空）。書き換えてもOK</p>
            </div>
          </div>

          {/* 仕入金額 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">仕入金額</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="purchasePrice" className="text-xs">仕入価格</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¥</span>
                  <Input
                    id="purchasePrice"
                    type="number"
                    min="0"
                    className="pl-7"
                    value={purchasePrice || ""}
                    onChange={(e) => setPurchasePrice(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discountPercent" className="text-xs">割引%</Label>
                <div className="relative">
                  <Input
                    id="discountPercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="pr-7"
                    value={discountPercent || ""}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discountPoints" className="text-xs">割引P</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">P</span>
                  <Input
                    id="discountPoints"
                    type="number"
                    min="0"
                    className="pl-7"
                    value={discountPoints || ""}
                    onChange={(e) => setDiscountPoints(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">合計</Label>
                <div className="h-9 px-3 flex items-center rounded-md border bg-muted/50 font-medium text-sm">
                  ¥{totalPurchasePrice.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* 重さ・サイズ（送料の自動計算） */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">梱包後の重さ・サイズ（送料を自動計算）</h3>
            <div className="grid grid-cols-4 gap-2">
              {([
                ["重さkg", weightKg, (v: number) => { setWeightKg(v); applyShip({ w: v }) }, "0.1"],
                ["長さcm", lengthCm, (v: number) => { setLengthCm(v); applyShip({ l: v }) }, "1"],
                ["幅cm", widthCm, (v: number) => { setWidthCm(v); applyShip({ wd: v }) }, "1"],
                ["高さcm", heightCm, (v: number) => { setHeightCm(v); applyShip({ h: v }) }, "1"],
              ] as const).map(([label, val, set, step]) => (
                <div key={label} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input type="number" inputMode="decimal" min="0" step={step} value={val || ""} onChange={(e) => set(Number(e.target.value))} />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {ship
                ? ship.overMax
                  ? "68kgを超えるため、SpeedPAK FedExでは送れません。"
                  : `SpeedPAK FedEx（アメリカ${pricing.zone === "usw" ? "西部" : "東部・カナダ"}）：課金重量 ${ship.billableKg}kg${ship.volumetricKg > Number(weightKg) ? `（寸法重量 ${ship.volumetricKg.toFixed(1)}kg）` : ""} → 基本 ¥${ship.baseJpy.toLocaleString()} ＋ 燃料 ¥${ship.fuelJpy.toLocaleString()} ＝ ¥${ship.totalJpy.toLocaleString()}（下の「送料¥」に自動で入ります）`
                : "重さを入れると、送料を自動で計算して「送料¥」に入れます。"}
            </p>
          </div>

          {/* 販売価格 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">販売価格</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sellingPriceUsd" className="text-xs">価格$</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    id="sellingPriceUsd"
                    type="number"
                    min="0"
                    step="0.01"
                    className="pl-7"
                    value={sellingPriceUsd || ""}
                    onChange={(e) => setSellingPriceUsd(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shippingCostUsd" className="text-xs">別送$</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    id="shippingCostUsd"
                    type="number"
                    min="0"
                    step="0.01"
                    className="pl-7"
                    value={shippingCostUsd || ""}
                    onChange={(e) => setShippingCostUsd(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shippingCostJpy" className="text-xs">送料¥</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¥</span>
                  <Input
                    id="shippingCostJpy"
                    type="number"
                    min="0"
                    className="pl-7"
                    value={shippingCostJpy || ""}
                    onChange={(e) => setShippingCostJpy(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customsDutyJpy" className="text-xs">関税¥</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">¥</span>
                  <Input
                    id="customsDutyJpy"
                    type="number"
                    min="0"
                    className="pl-7"
                    value={customsDutyJpy || ""}
                    onChange={(e) => setCustomsDutyJpy(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
            <p>
              この売値での利益：
              {profitNow === null ? "（価格$を入れると出ます）" : (
                <span className={profitNow >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                  {profitNow >= 0 ? "+" : ""}¥{profitNow.toLocaleString()}
                </span>
              )}
            </p>
            <p>
              利益 ¥{pricing.targetProfitJpy.toLocaleString()} に必要な売値：
              <span className="font-semibold">{needPrice === null ? "計算できません" : `$${needPrice.toFixed(2)}`}</span>
              {needPrice !== null && (
                <button type="button" className="ml-2 text-xs text-blue-600 underline" onClick={() => setSellingPriceUsd(needPrice)}>
                  この価格にする
                </button>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              eBay手数料{pricing.ebayFeePct}%・受取手数料{pricing.payoutFeePct}%・関税{pricing.dutyPct}%・為替¥{exchangeRate}で計算
            </p>
          </div>

          {/* メモ */}
          <div className="space-y-2">
            <Label htmlFor="memo">メモ</Label>
            <Textarea
              id="memo"
              placeholder="自由入力のメモ欄"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit">
              {editingSetting ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
