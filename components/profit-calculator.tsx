"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Calculator, RotateCcw, Save, ExternalLink, TrendingUp, TrendingDown } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface CalculatorInputs {
  purchasePrice: number
  domesticShipping: number
  taxRate: number
  sellingPriceUsd: number
  exchangeRate: number
  ebayFeeRate: number
  payoneerFeeRate: number
  internationalShippingUsd: number
  otherCostsJpy: number
}

const DEFAULT_INPUTS: CalculatorInputs = {
  purchasePrice: 9900,
  domesticShipping: 0,
  taxRate: 10,
  sellingPriceUsd: 170,
  exchangeRate: 150,
  ebayFeeRate: 13.25,
  payoneerFeeRate: 2.0,
  internationalShippingUsd: 45,
  otherCostsJpy: 0,
}

export function ProfitCalculator() {
  const [inputs, setInputs] = useState<CalculatorInputs>(DEFAULT_INPUTS)

  const updateInput = (key: keyof CalculatorInputs, value: string) => {
    const numValue = parseFloat(value) || 0
    setInputs((prev) => ({ ...prev, [key]: numValue }))
  }

  const calculations = useMemo(() => {
    // 販売価格を円換算
    const sellingPriceJpy = inputs.sellingPriceUsd * inputs.exchangeRate

    // 総仕入コスト（円）= 仕入価格 + 国内送料 + 消費税分 + その他費用
    const taxAmount = inputs.purchasePrice * (inputs.taxRate / 100)
    const totalPurchaseCost = inputs.purchasePrice + inputs.domesticShipping + taxAmount + inputs.otherCostsJpy

    // eBay落札手数料（$）= 販売価格 × eBay手数料%
    // eBayの手数料は販売価格に応じた固定手数料（$0.30/$0.40）も加算
    const perOrderFee = inputs.sellingPriceUsd <= 10 ? 0.30 : 0.40
    const ebayFeeUsd = (inputs.sellingPriceUsd * inputs.ebayFeeRate / 100) + perOrderFee
    
    // Payoneer手数料（$）= 販売価格 × Payoneer手数料%
    const payoneerFeeUsd = inputs.sellingPriceUsd * inputs.payoneerFeeRate / 100
    
    // 合計手数料（$）
    const totalFeesUsd = ebayFeeUsd + payoneerFeeUsd

    // 国際送料（円換算）
    const internationalShippingJpy = inputs.internationalShippingUsd * inputs.exchangeRate

    // 利益（円）= 販売価格（円）− 仕入コスト（円）− eBay手数料（円）− Payoneer手数料（円）− 国際送料（円）
    const totalFeesJpy = totalFeesUsd * inputs.exchangeRate
    const profitJpy = sellingPriceJpy - totalPurchaseCost - totalFeesJpy - internationalShippingJpy

    // 手取り額（$）= 販売価格 − 手数料 − 国際送料（参考表示用）
    const netProceedsUsd = inputs.sellingPriceUsd - totalFeesUsd - inputs.internationalShippingUsd
    const netProceedsJpy = netProceedsUsd * inputs.exchangeRate

    // 利益率（%）= 利益 ÷ 販売価格（円）× 100
    const profitRate = sellingPriceJpy > 0 ? (profitJpy / sellingPriceJpy) * 100 : 0

    return {
      sellingPriceJpy,
      taxAmount,
      totalPurchaseCost,
      ebayFeeUsd,
      payoneerFeeUsd,
      totalFeesUsd,
      totalFeesJpy,
      internationalShippingJpy,
      netProceedsUsd,
      netProceedsJpy,
      profitJpy,
      profitRate,
    }
  }, [inputs])

  const handleReset = () => {
    setInputs(DEFAULT_INPUTS)
  }

  const handleSave = () => {
    const memo = `仕入: ¥${inputs.purchasePrice.toLocaleString()} / 販売: $${inputs.sellingPriceUsd} / 利益: ¥${Math.round(calculations.profitJpy).toLocaleString()} (${calculations.profitRate.toFixed(1)}%)`
    alert(`メモに保存しました:\n${memo}`)
  }

  const handleListOnEbay = () => {
    window.open("https://www.ebay.com/sl/sell", "_blank")
  }

  const isProfit = calculations.profitJpy >= 0

  return (
    <div className="space-y-6">
      {/* 入力フォーム */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">入力情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 仕入れ情報 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">仕入れ情報</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchasePrice">仕入れ価格（円）</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">¥</span>
                  <Input
                    id="purchasePrice"
                    type="number"
                    value={inputs.purchasePrice || ""}
                    onChange={(e) => updateInput("purchasePrice", e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="domesticShipping">国内送料（円）</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">¥</span>
                  <Input
                    id="domesticShipping"
                    type="number"
                    value={inputs.domesticShipping || ""}
                    onChange={(e) => updateInput("domesticShipping", e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxRate">消費税（%）</Label>
                <div className="relative">
                  <Input
                    id="taxRate"
                    type="number"
                    value={inputs.taxRate || ""}
                    onChange={(e) => updateInput("taxRate", e.target.value)}
                    className="pr-7"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* eBay販売情報 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">eBay販売情報</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sellingPriceUsd">eBay販売価格（$）</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="sellingPriceUsd"
                    type="number"
                    value={inputs.sellingPriceUsd || ""}
                    onChange={(e) => updateInput("sellingPriceUsd", e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exchangeRate">為替レート（円/$）</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">¥</span>
                  <Input
                    id="exchangeRate"
                    type="number"
                    value={inputs.exchangeRate || ""}
                    onChange={(e) => updateInput("exchangeRate", e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ebayFeeRate">eBay落札手数料（%）</Label>
                <div className="relative">
                  <Input
                    id="ebayFeeRate"
                    type="number"
                    step="0.01"
                    value={inputs.ebayFeeRate || ""}
                    onChange={(e) => updateInput("ebayFeeRate", e.target.value)}
                    className="pr-7"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payoneerFeeRate">Payoneer手数料（%）</Label>
                <div className="relative">
                  <Input
                    id="payoneerFeeRate"
                    type="number"
                    step="0.01"
                    value={inputs.payoneerFeeRate || ""}
                    onChange={(e) => updateInput("payoneerFeeRate", e.target.value)}
                    className="pr-7"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 送料・その他 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">送料・その他</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="internationalShippingUsd">国際送料（$）</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="internationalShippingUsd"
                    type="number"
                    value={inputs.internationalShippingUsd || ""}
                    onChange={(e) => updateInput("internationalShippingUsd", e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="otherCostsJpy">その他費用（円）</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">¥</span>
                  <Input
                    id="otherCostsJpy"
                    type="number"
                    value={inputs.otherCostsJpy || ""}
                    onChange={(e) => updateInput("otherCostsJpy", e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 計算結果 */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">計算結果</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 利益（メイン表示） */}
          <div
            className={`rounded-lg p-6 text-center ${
              isProfit ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              {isProfit ? (
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-600" />
              )}
              <span className="text-sm font-medium text-muted-foreground">利益</span>
            </div>
            <div className={`text-4xl sm:text-5xl font-bold ${isProfit ? "text-emerald-600" : "text-red-600"}`}>
              ¥{Math.round(calculations.profitJpy).toLocaleString()}
            </div>
            <div className={`text-lg font-medium mt-1 ${isProfit ? "text-emerald-600" : "text-red-600"}`}>
              利益率 {calculations.profitRate.toFixed(1)}%
            </div>
          </div>

          {/* 計算式の説明 */}
          <div className="rounded-lg border bg-muted/20 p-4 text-sm">
            <div className="font-medium mb-2">計算式</div>
            <div className="text-muted-foreground space-y-1">
              <div>利益 = 販売価格（円）− 仕入コスト − eBay手数料 − Payoneer手数料 − 国際送料</div>
              <div className="text-xs">
                ¥{Math.round(calculations.sellingPriceJpy).toLocaleString()} − ¥{Math.round(calculations.totalPurchaseCost).toLocaleString()} − ¥{Math.round(calculations.ebayFeeUsd * inputs.exchangeRate).toLocaleString()} − ¥{Math.round(calculations.payoneerFeeUsd * inputs.exchangeRate).toLocaleString()} − ¥{Math.round(calculations.internationalShippingJpy).toLocaleString()}
              </div>
            </div>
          </div>

          {/* 詳細計算結果 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm text-muted-foreground mb-1">販売価格（円換算）</div>
              <div className="text-xl font-bold">¥{Math.round(calculations.sellingPriceJpy).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">
                ${inputs.sellingPriceUsd} × ¥{inputs.exchangeRate}
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm text-muted-foreground mb-1">総仕入コスト</div>
              <div className="text-xl font-bold">¥{Math.round(calculations.totalPurchaseCost).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">
                仕入 ¥{inputs.purchasePrice.toLocaleString()} + 送料 + 消費税
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm text-muted-foreground mb-1">eBay落札手数料</div>
              <div className="text-xl font-bold">${calculations.ebayFeeUsd.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {inputs.ebayFeeRate}% + ${inputs.sellingPriceUsd <= 10 ? '0.30' : '0.40'}（固定）
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm text-muted-foreground mb-1">Payoneer手数料</div>
              <div className="text-xl font-bold">${calculations.payoneerFeeUsd.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                販売価格 × {inputs.payoneerFeeRate}%
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm text-muted-foreground mb-1">合計手数料</div>
              <div className="text-xl font-bold text-orange-600">${calculations.totalFeesUsd.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                eBay + Payoneer（¥{Math.round(calculations.totalFeesJpy).toLocaleString()}）
              </div>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="text-sm text-muted-foreground mb-1">国際送料</div>
              <div className="text-xl font-bold">${inputs.internationalShippingUsd}</div>
              <div className="text-xs text-muted-foreground mt-1">
                ¥{Math.round(calculations.internationalShippingJpy).toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* アクションボタン */}
      <div className="flex flex-col sm:flex-row gap-3 pb-6">
        <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto">
          <RotateCcw className="mr-2 h-4 w-4" />
          計算をリセット
        </Button>
        <Button variant="outline" onClick={handleSave} className="w-full sm:w-auto">
          <Save className="mr-2 h-4 w-4" />
          この条件でメモに保存
        </Button>
        <Button onClick={handleListOnEbay} className="w-full sm:flex-1">
          <ExternalLink className="mr-2 h-4 w-4" />
          eBayに出品する
        </Button>
      </div>
    </div>
  )
}
