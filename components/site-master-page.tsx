"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, Settings2, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import type { SiteMaster } from "./site-master"

interface SiteMasterPageProps {
  siteMasters: SiteMaster[]
  onAdd: (data: Omit<SiteMaster, "id" | "createdAt">) => void
  onUpdate: (id: string, data: Omit<SiteMaster, "id" | "createdAt">) => void
  onDelete: (id: string) => void
}

interface FormState {
  siteName: string
  displayName: string
  inStockKeywords: string
  outOfStockKeywords: string
}

const EMPTY_FORM: FormState = {
  siteName: "",
  displayName: "",
  inStockKeywords: "",
  outOfStockKeywords: "",
}

export function SiteMasterPage({
  siteMasters,
  onAdd,
  onUpdate,
  onDelete,
}: SiteMasterPageProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const handleOpenAdd = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (site: SiteMaster) => {
    setForm({
      siteName: site.siteName,
      displayName: site.displayName,
      inStockKeywords: site.inStockKeywords,
      outOfStockKeywords: site.outOfStockKeywords,
    })
    setEditingId(site.id)
    setIsFormOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingId) {
      onUpdate(editingId, form)
    } else {
      onAdd(form)
    }
    setIsFormOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const handleClose = () => {
    setIsFormOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Settings2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">サイトマスタ</h1>
            <p className="text-sm text-muted-foreground">
              仕入先サイトごとの在庫監視キーワードを管理
            </p>
          </div>
        </div>
        <Button onClick={handleOpenAdd} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          新規追加
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-3 sm:p-4">
          <div className="text-2xl sm:text-3xl font-bold">{siteMasters.length}</div>
          <div className="text-xs sm:text-sm text-muted-foreground">登録サイト数</div>
        </div>
        <div className="rounded-lg border bg-card p-3 sm:p-4">
          <div className="text-2xl sm:text-3xl font-bold text-emerald-600">
            {siteMasters.filter(s => s.inStockKeywords || s.outOfStockKeywords).length}
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground">キーワード設定済み</div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[120px]">サイト名</TableHead>
              <TableHead className="w-[120px]">表示名</TableHead>
              <TableHead>在庫ありキーワード</TableHead>
              <TableHead>在庫なしキーワード</TableHead>
              <TableHead className="w-[60px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {siteMasters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  サイトマスタが登録されていません
                </TableCell>
              </TableRow>
            ) : (
              siteMasters.map((site) => (
                <TableRow key={site.id}>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {site.siteName}
                  </TableCell>
                  <TableCell className="font-medium">{site.displayName}</TableCell>
                  <TableCell>
                    {site.inStockKeywords ? (
                      <div className="flex flex-wrap gap-1">
                        {site.inStockKeywords.split(",").map((kw, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2 py-0.5 text-xs font-medium"
                          >
                            {kw.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">未設定</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {site.outOfStockKeywords ? (
                      <div className="flex flex-wrap gap-1">
                        {site.outOfStockKeywords.split(",").map((kw, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full bg-red-500/10 text-red-700 border border-red-500/20 px-2 py-0.5 text-xs font-medium"
                          >
                            {kw.trim()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">未設定</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">メニューを開く</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEdit(site)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          編集
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteId(site.id)}
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

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {siteMasters.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-muted-foreground">
            サイトマスタが登録されていません
          </div>
        ) : (
          siteMasters.map((site) => (
            <div key={site.id} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{site.displayName}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{site.siteName}</div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenEdit(site)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      編集
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setDeleteId(site.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      削除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-2 text-sm border-t pt-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">在庫ありキーワード</div>
                  {site.inStockKeywords ? (
                    <div className="flex flex-wrap gap-1">
                      {site.inStockKeywords.split(",").map((kw, i) => (
                        <span key={i} className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2 py-0.5 text-xs font-medium">
                          {kw.trim()}
                        </span>
                      ))}
                    </div>
                  ) : <span className="text-muted-foreground">未設定</span>}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">在庫なしキーワード</div>
                  {site.outOfStockKeywords ? (
                    <div className="flex flex-wrap gap-1">
                      {site.outOfStockKeywords.split(",").map((kw, i) => (
                        <span key={i} className="inline-flex items-center rounded-full bg-red-500/10 text-red-700 border border-red-500/20 px-2 py-0.5 text-xs font-medium">
                          {kw.trim()}
                        </span>
                      ))}
                    </div>
                  ) : <span className="text-muted-foreground">未設定</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "サイトを編集" : "サイトを新規追加"}</DialogTitle>
            <DialogDescription>
              仕入先サイトの情報と在庫監視キーワードを設定してください。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="siteName">サイトID（英数字）</Label>
                <Input
                  id="siteName"
                  placeholder="例: mercari"
                  value={form.siteName}
                  onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">英小文字・ハイフンのみ</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">表示名</Label>
                <Input
                  id="displayName"
                  placeholder="例: メルカリ"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inStockKeywords">在庫ありキーワード</Label>
              <Input
                id="inStockKeywords"
                placeholder="例: 購入手続きへ, カートに入れる"
                value={form.inStockKeywords}
                onChange={(e) => setForm({ ...form, inStockKeywords: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">カンマ区切りで複数入力可</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="outOfStockKeywords">在庫なしキーワード</Label>
              <Input
                id="outOfStockKeywords"
                placeholder="例: 売り切れ, SOLD, 終了"
                value={form.outOfStockKeywords}
                onChange={(e) => setForm({ ...form, outOfStockKeywords: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">カンマ区切りで複数入力可</p>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                キャンセル
              </Button>
              <Button type="submit">
                {editingId ? "更新" : "追加"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>サイトを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。このサイトを仕入れ設定で使用している場合、正しく動作しなくなる可能性があります。
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
    </div>
  )
}
