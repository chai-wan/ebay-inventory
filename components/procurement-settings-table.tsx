"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useState } from "react"
import { MoreHorizontal, Pencil, Trash2, RefreshCw, Play, Pause, ExternalLink } from "lucide-react"
import type { ProcurementSetting } from "./procurement-settings-form"
import type { SiteMaster } from "./site-master"
import { extractEbayItemId } from "@/lib/utils"

interface ProcurementSettingsTableProps {
  settings: ProcurementSetting[]
  siteMasters: SiteMaster[]
  exchangeRate: number
  onEdit: (setting: ProcurementSetting) => void
  onDelete: (id: string) => void
  onCheck: (id: string) => void
  onToggleStatus: (id: string) => void
}

function calcTotalCostJpy(setting: ProcurementSetting): number {
  return Math.round(
    setting.purchasePrice * (1 - setting.discountPercent / 100) -
    setting.discountPoints +
    setting.shippingCostJpy +
    setting.customsDutyJpy
  )
}

function calcProfitJpy(setting: ProcurementSetting, exchangeRate: number): number {
  const revenueJpy = (setting.sellingPriceUsd + setting.shippingCostUsd) * exchangeRate
  const costJpy = calcTotalCostJpy(setting)
  return Math.round(revenueJpy - costJpy)
}

export function ProcurementSettingsTable({
  settings,
  siteMasters,
  exchangeRate,
  onEdit,
  onDelete,
  onCheck,
  onToggleStatus,
}: ProcurementSettingsTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const getSiteDisplayName = (siteName: string) => {
    return siteMasters.find((s) => s.siteName === siteName)?.displayName ?? siteName
  }

  const getStatusBadge = (status: ProcurementSetting["status"]) => {
    switch (status) {
      case "monitoring":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/15">
            監視中
          </Badge>
        )
      case "stopped":
        return <Badge variant="secondary">停止中</Badge>
      case "error":
        return <Badge variant="destructive">エラー</Badge>
    }
  }

  const getMercariBadge = (s?: string | null) => {
    switch (s) {
      case "active":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/15">
            在庫あり
          </Badge>
        )
      case "sold_out":
        return <Badge variant="destructive">売り切れ</Badge>
      case "hold":
        return <Badge variant="secondary">保留</Badge>
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            未チェック
          </Badge>
        )
    }
  }

  const formatCheckedAt = (d?: Date | null) => {
    if (!d) return "未チェック"
    const dt = d instanceof Date ? d : new Date(d)
    if (isNaN(dt.getTime())) return "未チェック"
    return dt.toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getProfitDisplay = (setting: ProcurementSetting) => {
    const profit = calcProfitJpy(setting, exchangeRate)
    const isPositive = profit >= 0
    return (
      <div className={`font-semibold text-sm ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
        {isPositive ? "+" : ""}¥{profit.toLocaleString()}
      </div>
    )
  }

  const truncateUrl = (url: string, maxLength = 30) => {
    if (!url) return "-"
    if (url.length <= maxLength) return url
    return url.substring(0, maxLength) + "..."
  }

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden lg:block rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="min-w-[250px]">eBay商品名</TableHead>
                <TableHead className="w-[140px]">ItemID</TableHead>
                <TableHead className="w-[180px]">仕入URL</TableHead>
                <TableHead className="w-[150px]">eBay参考URL</TableHead>
                <TableHead className="w-[150px]">仕入金額</TableHead>
                <TableHead className="w-[130px]">販売価格 / 利益</TableHead>
                <TableHead className="w-[110px]">在庫</TableHead>
                <TableHead className="w-[100px]">仕入元</TableHead>
                <TableHead className="w-[80px]">ステータス</TableHead>
                <TableHead className="w-[60px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    登録された設定がありません
                  </TableCell>
                </TableRow>
              ) : (
                settings.map((setting) => (
                  <TableRow key={setting.id}>
                    <TableCell>
                      {setting.ebayUrl ? (
                        <a
                          href={setting.ebayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center gap-1 text-sm font-medium line-clamp-2 max-w-[280px]"
                        >
                          {setting.ebayProductName || truncateUrl(setting.ebayUrl, 30)}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <div className="text-sm font-medium line-clamp-2 max-w-[280px]">
                          {setting.ebayProductName || <span className="text-muted-foreground">-</span>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const itemId = extractEbayItemId(setting.ebayUrl)
                        return itemId ? (
                          <a
                            href={setting.ebayUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm tabular-nums"
                          >
                            {itemId}
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )
                      })()}
                    </TableCell>
                    <TableCell>
                      <a
                        href={setting.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
                      >
                        {truncateUrl(setting.productUrl)}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell>
                      {setting.ebayReferenceUrl ? (
                        <a
                          href={setting.ebayReferenceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:underline inline-flex items-center gap-1 text-sm"
                        >
                          {truncateUrl(setting.ebayReferenceUrl, 25)}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-sm">
                        <div className="text-muted-foreground">
                          仕入¥{setting.purchasePrice.toLocaleString()}
                        </div>
                        <div className="font-medium">
                          合計¥{calcTotalCostJpy(setting).toLocaleString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-medium text-sm">
                          ${setting.sellingPriceUsd.toFixed(2)}
                        </div>
                        {getProfitDisplay(setting)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {getMercariBadge(setting.mercariStatus)}
                        <div className="text-xs text-muted-foreground">
                          {formatCheckedAt(setting.mercariCheckedAt)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {getSiteDisplayName(setting.siteName)}
                    </TableCell>
                    <TableCell>{getStatusBadge(setting.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">メニューを開く</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onCheck(setting.id)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            今すぐチェック
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onToggleStatus(setting.id)}>
                            {setting.status === "monitoring" ? (
                              <>
                                <Pause className="mr-2 h-4 w-4" />
                                監視を停止
                              </>
                            ) : (
                              <>
                                <Play className="mr-2 h-4 w-4" />
                                監視を開始
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onEdit(setting)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            編集
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteId(setting.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            削除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Tablet/Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {settings.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-muted-foreground">
            登録された設定がありません
          </div>
        ) : (
          settings.map((setting) => {
            const profit = calcProfitJpy(setting, exchangeRate)
            const isPositive = profit >= 0
            return (
              <div key={setting.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      {getSiteDisplayName(setting.siteName)}
                      {getMercariBadge(setting.mercariStatus)}
                      {getStatusBadge(setting.status)}
                    </div>
                    {setting.ebayUrl ? (
                      <a
                        href={setting.ebayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline font-medium line-clamp-2 inline-flex items-start gap-1"
                      >
                        {setting.ebayProductName || truncateUrl(setting.ebayUrl, 40)}
                        <ExternalLink className="h-3 w-3 shrink-0 mt-0.5" />
                      </a>
                    ) : setting.ebayProductName ? (
                      <div className="text-sm text-foreground font-medium line-clamp-2">
                        {setting.ebayProductName}
                      </div>
                    ) : null}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onCheck(setting.id)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        今すぐチェック
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onToggleStatus(setting.id)}>
                        {setting.status === "monitoring" ? (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                            監視を停止
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            監視を開始
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onEdit(setting)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        編集
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteId(setting.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        削除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* URLs */}
                <div className="space-y-1.5 text-sm">
                  {extractEbayItemId(setting.ebayUrl) && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-14 shrink-0">ItemID</span>
                      <a
                        href={setting.ebayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline tabular-nums"
                      >
                        {extractEbayItemId(setting.ebayUrl)}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-14 shrink-0">仕入</span>
                    <a
                      href={setting.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1 truncate"
                    >
                      {truncateUrl(setting.productUrl, 35)}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                  {setting.ebayReferenceUrl && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-14 shrink-0">参考</span>
                      <a
                        href={setting.ebayReferenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:underline inline-flex items-center gap-1 truncate"
                      >
                        {truncateUrl(setting.ebayReferenceUrl, 35)}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                  )}
                </div>

                {/* メルカリ最終チェック */}
                <div className="text-xs text-muted-foreground">
                  最終チェック: {formatCheckedAt(setting.mercariCheckedAt)}
                </div>

                {/* Price Info + Profit */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">仕入金額</div>
                    <div className="text-sm text-muted-foreground">
                      仕入¥{setting.purchasePrice.toLocaleString()}
                      {(setting.discountPercent > 0 || setting.discountPoints > 0) && (
                        <span className="ml-1">
                          {setting.discountPercent > 0 && `(-${setting.discountPercent}%)`}
                          {setting.discountPoints > 0 && `(-${setting.discountPoints}P)`}
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-sm">
                      合計¥{calcTotalCostJpy(setting).toLocaleString()}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">販売価格</div>
                    <div className="font-medium text-lg">
                      ${setting.sellingPriceUsd.toFixed(2)}
                    </div>
                    {setting.shippingCostUsd > 0 && (
                      <div className="text-sm text-muted-foreground">
                        +送料${setting.shippingCostUsd.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Profit Row */}
                <div className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold ${isPositive ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-700"}`}>
                  <span>利益</span>
                  <span>{isPositive ? "+" : ""}¥{profit.toLocaleString()}</span>
                </div>

                {setting.memo && (
                  <p className="text-sm text-muted-foreground border-t pt-2">
                    {setting.memo}
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>設定を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。この設定は完全に削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  onDelete(deleteId)
                  setDeleteId(null)
                }
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
