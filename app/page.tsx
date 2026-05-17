"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Package } from "lucide-react"
import { ProcurementSettingsForm, type ProcurementSetting } from "@/components/procurement-settings-form"
import { ProcurementSettingsTable } from "@/components/procurement-settings-table"
import { SiteMasterPage } from "@/components/site-master-page"
import type { SiteMaster } from "@/components/site-master"
import { supabase } from "@/lib/supabase"

type Tab = "procurement" | "site-master"

export default function ProcurementSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("procurement")
  const [settings, setSettings] = useState<ProcurementSetting[]>([])
  const [siteMasters, setSiteMasters] = useState<SiteMaster[]>([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSetting, setEditingSetting] = useState<ProcurementSetting | null>(null)
  const [exchangeRate, setExchangeRate] = useState<number>(150)
  const [exchangeRateInput, setExchangeRateInput] = useState<string>("150")
  const [loading, setLoading] = useState(true)
  const [rateLoading, setRateLoading] = useState(true)

  useEffect(() => {
    loadSiteMasters()
    loadSettings()
    fetchExchangeRate()
  }, [])

  const fetchExchangeRate = async () => {
    setRateLoading(true)
    try {
      const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=JPY")
      const data = await res.json()
      const rate = Math.round(data.rates.JPY * 100) / 100
      setExchangeRate(rate)
      setExchangeRateInput(String(rate))
    } catch (e) {
      console.error("為替レート取得失敗:", e)
    } finally {
      setRateLoading(false)
    }
  }

  const loadSiteMasters = async () => {
    const { data, error } = await supabase
      .from('site_masters')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) { console.error('サイトマスタ読み込みエラー:', error); return }
    const mapped: SiteMaster[] = (data || []).map((row: any) => ({
      id: row.id,
      siteName: row.site_name,
      displayName: row.display_name,
      inStockKeywords: row.in_stock_keywords,
      outOfStockKeywords: row.out_of_stock_keywords,
      createdAt: new Date(row.created_at),
    }))
    setSiteMasters(mapped)
  }

  const loadSettings = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('procurement_settings')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) { console.error('仕入れ設定読み込みエラー:', error); setLoading(false); return }
    const mapped: ProcurementSetting[] = (data || []).map((row: any) => ({
      id: row.id,
      siteName: row.site_name,
      productUrl: row.product_url,
      ebayUrl: row.ebay_url,
      ebayReferenceUrl: row.ebay_reference_url,
      ebayProductName: row.ebay_product_name,
      monitoringInterval: row.monitoring_interval,
      memo: row.memo,
      status: row.status,
      createdAt: new Date(row.created_at),
      purchasePrice: row.purchase_price,
      discountPercent: row.discount_percent,
      discountPoints: row.discount_points,
      sellingPriceUsd: row.selling_price_usd,
      shippingCostUsd: row.shipping_cost_usd,
      shippingCostJpy: row.shipping_cost_jpy,
      customsDutyJpy: row.customs_duty_jpy,
    }))
    setSettings(mapped)
    setLoading(false)
  }

  const handleAdd = async (newSetting: Omit<ProcurementSetting, "id" | "createdAt" | "status">) => {
    const { error } = await supabase
      .from('procurement_settings')
      .insert([{
        site_name: newSetting.siteName,
        product_url: newSetting.productUrl,
        ebay_url: newSetting.ebayUrl,
        ebay_reference_url: newSetting.ebayReferenceUrl,
        ebay_product_name: newSetting.ebayProductName,
        monitoring_interval: newSetting.monitoringInterval,
        memo: newSetting.memo,
        status: 'monitoring',
        purchase_price: newSetting.purchasePrice,
        discount_percent: newSetting.discountPercent,
        discount_points: newSetting.discountPoints,
        selling_price_usd: newSetting.sellingPriceUsd,
        shipping_cost_usd: newSetting.shippingCostUsd,
        shipping_cost_jpy: newSetting.shippingCostJpy,
        customs_duty_jpy: newSetting.customsDutyJpy,
      }])
    if (error) { console.error('追加エラー:', error); return }
    await loadSettings()
    setIsFormOpen(false)
  }

  const handleEdit = (setting: ProcurementSetting) => {
    setEditingSetting(setting)
    setIsFormOpen(true)
  }

  const handleUpdate = async (updatedData: Omit<ProcurementSetting, "id" | "createdAt" | "status">) => {
    if (!editingSetting) return
    const { error } = await supabase
      .from('procurement_settings')
      .update({
        site_name: updatedData.siteName,
        product_url: updatedData.productUrl,
        ebay_url: updatedData.ebayUrl,
        ebay_reference_url: updatedData.ebayReferenceUrl,
        ebay_product_name: updatedData.ebayProductName,
        monitoring_interval: updatedData.monitoringInterval,
        memo: updatedData.memo,
        purchase_price: updatedData.purchasePrice,
        discount_percent: updatedData.discountPercent,
        discount_points: updatedData.discountPoints,
        selling_price_usd: updatedData.sellingPriceUsd,
        shipping_cost_usd: updatedData.shippingCostUsd,
        shipping_cost_jpy: updatedData.shippingCostJpy,
        customs_duty_jpy: updatedData.customsDutyJpy,
      })
      .eq('id', editingSetting.id)
    if (error) { console.error('更新エラー:', error); return }
    await loadSettings()
    setEditingSetting(null)
    setIsFormOpen(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('procurement_settings')
      .delete()
      .eq('id', id)
    if (error) { console.error('削除エラー:', error); return }
    await loadSettings()
  }

  const handleCheck = (id: string) => {
    alert(`ID: ${id} の商品ページをチェックしています...`)
  }

  const handleToggleStatus = async (id: string) => {
    const setting = settings.find(s => s.id === id)
    if (!setting) return
    const newStatus = setting.status === "monitoring" ? "stopped" : "monitoring"
    const { error } = await supabase
      .from('procurement_settings')
      .update({ status: newStatus })
      .eq('id', id)
    if (error) { console.error('ステータス更新エラー:', error); return }
    await loadSettings()
  }

  const handleFormClose = (open: boolean) => {
    if (!open) setEditingSetting(null)
    setIsFormOpen(open)
  }

  const handleExchangeRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setExchangeRateInput(val)
    const num = parseFloat(val)
    if (!isNaN(num) && num > 0) setExchangeRate(num)
  }

  const handleSiteAdd = async (data: Omit<SiteMaster, "id" | "createdAt">) => {
    const { error } = await supabase
      .from('site_masters')
      .insert([{
        site_name: data.siteName,
        display_name: data.displayName,
        in_stock_keywords: data.inStockKeywords,
        out_of_stock_keywords: data.outOfStockKeywords,
      }])
    if (error) { console.error('サイト追加エラー:', error); return }
    await loadSiteMasters()
  }

  const handleSiteUpdate = async (id: string, data: Omit<SiteMaster, "id" | "createdAt">) => {
    const { error } = await supabase
      .from('site_masters')
      .update({
        site_name: data.siteName,
        display_name: data.displayName,
        in_stock_keywords: data.inStockKeywords,
        out_of_stock_keywords: data.outOfStockKeywords,
      })
      .eq('id', id)
    if (error) { console.error('サイト更新エラー:', error); return }
    await loadSiteMasters()
  }

  const handleSiteDelete = async (id: string) => {
    const { error } = await supabase
      .from('site_masters')
      .delete()
      .eq('id', id)
    if (error) { console.error('サイト削除エラー:', error); return }
    await loadSiteMasters()
  }

  const monitoringCount = settings.filter((s) => s.status === "monitoring").length
  const errorCount = settings.filter((s) => s.status === "error").length
  const totalPurchase = settings.reduce((sum, s) => {
    return sum + Math.round(s.purchasePrice * (1 - s.discountPercent / 100) - s.discountPoints)
  }, 0)
  const totalSales = settings.reduce((sum, s) => sum + s.sellingPriceUsd, 0)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">

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

        {activeTab === "procurement" && (
          <>
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
                  <button
                    onClick={fetchExchangeRate}
                    disabled={rateLoading}
                    className="text-xs text-blue-600 hover:underline disabled:text-muted-foreground whitespace-nowrap"
                  >
                    {rateLoading ? "取得中..." : "更新"}
                  </button>
                </div>
                <Button onClick={() => setIsFormOpen(true)} className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  新規追加
                </Button>
              </div>
            </div>

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

            {loading ? (
              <div className="rounded-lg border p-8 text-center text-muted-foreground">
                読み込み中...
              </div>
            ) : (
              <ProcurementSettingsTable
                settings={settings}
                siteMasters={siteMasters}
                exchangeRate={exchangeRate}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onCheck={handleCheck}
                onToggleStatus={handleToggleStatus}
              />
            )}

            <ProcurementSettingsForm
              open={isFormOpen}
              onOpenChange={handleFormClose}
              onSubmit={editingSetting ? handleUpdate : handleAdd}
              editingSetting={editingSetting}
              siteMasters={siteMasters}
            />
          </>
        )}

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