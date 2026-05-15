"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Package } from "lucide-react"
import { ProcurementSettingsForm, type ProcurementSetting } from "@/components/procurement-settings-form"
import { ProcurementSettingsTable } from "@/components/procurement-settings-table"
import { SiteMasterPage } from "@/components/site-master-page"
import { INITIAL_SITE_MASTERS, type SiteMaster } from "@/components/site-master"

const INITIAL_SETTINGS: ProcurementSetting[] = [
  {
    id: "1",
    siteName: "mercari",
    productUrl: "https://jp.mercari.com/item/m12345678901",
    ebayUrl: "https://www.ebay.com/itm/137007103645",
    ebayReferenceUrl: "https://www.ebay.com/sch/i.html?_nkw=gakken+record+maker",
    ebayProductName: "Toy Record Maker Kit Gakken Adult Science Magazine Book from Japan",
    monitoringInterval: "30",
    memo: "人気商品のため在庫監視中",
    status: "monitoring",
    createdAt: new Date("2024-01-15"),
    purchasePrice: 9900,
    discountPercent: 0,
    discountPoints: 0,
    sellingPriceUsd: 170.0,
    shippingCostUsd: 0,
    shippingCostJpy: 0,
    customsDutyJpy: 0,
  },
  {
    id: "2",
    siteName: "yahoo-auction",
    productUrl: "https://page.auctions.yahoo.co.jp/jp/auction/h1234567890",
    ebayUrl: "https://www.ebay.com/itm/136920249999",
    ebayReferenceUrl: "https://www.ebay.com/sch/i.html?_nkw=victor+tape+deck+selector",
    ebayProductName: "Victor JX-53 Tape Deck Selector Audio Switcher Working Unit Vintage JPN",
    monitoringInterval: "60",
    memo: "ビンテージオーディオ機器",
    status: "monitoring",
    createdAt: new Date("2024-01-20"),
    purchasePrice: 4350,
    discountPercent: 0,
    discountPoints: 0,
    sellingPriceUsd: 120.0,
    shippingCostUsd: 0,
    shippingCostJpy: 0,
    customsDutyJpy: 0,
  },
  {
    id: "3",
    siteName: "rakuma",
    productUrl: "https://fril.jp/item/xxxxxxxxxxxxx",
    ebayUrl: "",
    ebayReferenceUrl: "",
    ebayProductName: "Pokemon Card Game Pikachu VMAX Rainbow Rare Japanese",
    monitoringInterval: "180",
    memo: "競合が多い商品",
    status: "stopped",
    createdAt: new Date("2024-02-01"),
    purchasePrice: 5500,
    discountPercent: 10,
    discountPoints: 500,
    sellingPriceUsd: 89.99,
    shippingCostUsd: 15.0,
    shippingCostJpy: 1200,
    customsDutyJpy: 0,
  },
  {
    id: "4",
    siteName: "amazon",
    productUrl: "https://www.amazon.co.jp/dp/B08XXXXX",
    ebayUrl: "https://www.ebay.com/itm/123456789012",
    ebayReferenceUrl: "https://www.ebay.com/sch/i.html?_nkw=japanese+figure",
    ebayProductName: "Bandai Gundam RG 1/144 RX-78-2 Model Kit Japan Import",
    monitoringInterval: "30",
    memo: "ページが見つからないためエラー",
    status: "error",
    createdAt: new Date("2024-02-10"),
    purchasePrice: 12800,
    discountPercent: 5,
    discountPoints: 0,
    sellingPriceUsd: 150.0,
    shippingCostUsd: 25.0,
    shippingCostJpy: 2500,
    customsDutyJpy: 500,
  },
]

type Tab = "procurement" | "site-master"

export default function ProcurementSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("procurement")
  const [settings, setSettings] = useState<ProcurementSetting[]>(INITIAL_SETTINGS)
  const [siteMasters, setSiteMasters] = useState<SiteMaster[]>(INITIAL_SITE_MASTERS)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSetting, setEditingSetting] = useState<ProcurementSetting | null>(null)
  const [exchangeRate, setExchangeRate] = useState<number>(150)
  const [exchangeRateInput, setExchangeRateInput] = useState<string>("150")

  // --- 仕入れ設定 CRUD ---
  const handleAdd = (newSetting: Omit<ProcurementSetting, "id" | "createdAt" | "status">) => {
    const setting: ProcurementSetting = {
      ...newSetting,
      id: crypto.randomUUID(),
      status: "monitoring",
      createdAt: new Date(),
    }
    setSettings((prev) => [...prev, setting])
    setIsFormOpen(false)
  }

  const handleEdit = (setting: ProcurementSetting) => {
    setEditingSetting(setting)
    setIsFormOpen(true)
  }

  const handleUpdate = (updatedData: Omit<ProcurementSetting, "id" | "createdAt" | "status">) => {
    if (!editingSetting) return
    setSettings((prev) =>
      prev.map((s) => s.id === editingSetting.id ? { ...s, ...updatedData } : s)
    )
    setEditingSetting(null)
    setIsFormOpen(false)
  }

  const handleDelete = (id: string) => {
    setSettings((prev) => prev.filter((s) => s.id !== id))
  }

  const handleCheck = (id: string) => {
    alert(`ID: ${id} の商品ページをチェックしています...`)
  }

  const handleToggleStatus = (id: string) => {
    setSettings((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: s.status === "monitoring" ? "stopped" : "monitoring" }
          : s
      )
    )
  }

  const handleFormClose = (open: boolean) => {
    if (!open) setEditingSetting(null)
    setIsFormOpen(open)
  }

  // 為替レート入力処理
  const handleExchangeRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setExchangeRateInput(val)
    const num = parseFloat(val)
    if (!isNaN(num) && num > 0) {
      setExchangeRate(num)
    }
  }

  // --- サイトマスタ CRUD ---
  const handleSiteAdd = (data: Omit<SiteMaster, "id" | "createdAt">) => {
    const site: SiteMaster = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    }
    setSiteMasters((prev) => [...prev, site])
  }

  const handleSiteUpdate = (id: string, data: Omit<SiteMaster, "id" | "createdAt">) => {
    setSiteMasters((prev) =>
      prev.map((s) => s.id === id ? { ...s, ...data } : s)
    )
  }

  const handleSiteDelete = (id: string) => {
    setSiteMasters((prev) => prev.filter((s) => s.id !== id))
  }

  // --- 集計 ---
  const monitoringCount = settings.filter((s) => s.status === "monitoring").length
  const errorCount = settings.filter((s) => s.status === "error").length
  const totalPurchase = settings.reduce((sum, s) => {
    return sum + Math.round(s.purchasePrice * (1 - s.discountPercent / 100) - s.discountPoints)
  }, 0)
  const totalSales = settings.reduce((sum, s) => sum + s.sellingPriceUsd, 0)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">

        {/* タブナビゲーション */}
        <div className="flex gap-1 mb-6 bg-muted/50 rounded-lg p-1 w-full sm:w-auto sm:inline-flex">
          <button
            onClick={() => setActiveTab("procurement")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "procurement"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            仕入れ設定
          </button>
          <button
            onClick={() => setActiveTab("site-master")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "site-master"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            サイトマスタ
          </button>
        </div>

        {/* 仕入れ設定タブ */}
        {activeTab === "procurement" && (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight">仕入れ設定</h1>
                  <p className="text-sm text-muted-foreground">商品ページの監視設定を管理</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* 為替レート入力 */}
                <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">為替レート</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">¥</span>
                    <Input
                      type="number"
                      min="1"
                      step="0.01"
                      value={exchangeRateInput}
                      onChange={handleExchangeRateChange}
                      className="w-20 h-7 text-sm border-0 p-0 focus-visible:ring-0 font-medium"
                    />
                    <span className="text-sm text-muted-foreground">/$</span>
                  </div>
                </div>
                <Button onClick={() => setIsFormOpen(true)} className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  新規追加
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-6">
              <div className="rounded-lg border bg-card p-3 sm:p-4">
                <div className="text-2xl sm:text-3xl font-bold">{settings.length}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">登録数</div>
              </div>
              <div className="rounded-lg border bg-card p-3 sm:p-4">
                <div className="text-2xl sm:text-3xl font-bold text-emerald-600">{monitoringCount}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">監視中</div>
              </div>
              <div className="rounded-lg border bg-card p-3 sm:p-4">
                <div className="text-2xl sm:text-3xl font-bold text-destructive">{errorCount}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">エラー</div>
              </div>
              <div className="rounded-lg border bg-card p-3 sm:p-4">
                <div className="text-lg sm:text-2xl font-bold">¥{totalPurchase.toLocaleString()}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">総仕入金額</div>
              </div>
              <div className="rounded-lg border bg-card p-3 sm:p-4">
                <div className="text-lg sm:text-2xl font-bold text-blue-600">${totalSales.toFixed(2)}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">総販売価格</div>
              </div>
            </div>

            {/* Table */}
            <ProcurementSettingsTable
              settings={settings}
              siteMasters={siteMasters}
              exchangeRate={exchangeRate}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onCheck={handleCheck}
              onToggleStatus={handleToggleStatus}
            />

            {/* Form Dialog */}
            <ProcurementSettingsForm
              open={isFormOpen}
              onOpenChange={handleFormClose}
              onSubmit={editingSetting ? handleUpdate : handleAdd}
              editingSetting={editingSetting}
              siteMasters={siteMasters}
            />
          </>
        )}

        {/* サイトマスタタブ */}
        {activeTab === "site-master" && (
          <SiteMasterPage
            siteMasters={siteMasters}
            onAdd={handleSiteAdd}
            onUpdate={handleSiteUpdate}
            onDelete={handleSiteDelete}
          />
        )}

      </div>
    </div>
  )
}
