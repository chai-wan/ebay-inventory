// site-master.ts
// サイトマスタの型定義と初期データ

export interface SiteMaster {
  id: string
  siteName: string      // システム内部キー (例: mercari)
  displayName: string   // 表示名 (例: メルカリ)
  inStockKeywords: string
  outOfStockKeywords: string
  createdAt: Date
}

export const INITIAL_SITE_MASTERS: SiteMaster[] = [
  {
    id: "site-1",
    siteName: "mercari",
    displayName: "メルカリ",
    inStockKeywords: "購入手続きへ",
    outOfStockKeywords: "売り切れ,SOLD",
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "site-2",
    siteName: "yahoo-auction",
    displayName: "ヤフオク",
    inStockKeywords: "入札する,ウォッチリストに追加",
    outOfStockKeywords: "終了,落札済み",
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "site-3",
    siteName: "rakuma",
    displayName: "ラクマ",
    inStockKeywords: "購入する",
    outOfStockKeywords: "売り切れました",
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "site-4",
    siteName: "amazon",
    displayName: "Amazon",
    inStockKeywords: "カートに入れる",
    outOfStockKeywords: "在庫切れ,入荷予定あり",
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "site-5",
    siteName: "yahoo-shopping",
    displayName: "Yahooショッピング",
    inStockKeywords: "カートに入れる",
    outOfStockKeywords: "在庫切れ",
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "site-6",
    siteName: "rakuten",
    displayName: "楽天",
    inStockKeywords: "カートに入れる",
    outOfStockKeywords: "在庫切れ",
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "site-7",
    siteName: "surugaya",
    displayName: "駿河屋",
    inStockKeywords: "カートに入れる",
    outOfStockKeywords: "在庫なし",
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "site-8",
    siteName: "other",
    displayName: "その他",
    inStockKeywords: "",
    outOfStockKeywords: "",
    createdAt: new Date("2024-01-01"),
  },
]
