// 古物台帳（kobutsu_ledger）の列の定義。オーナーのExcel「古物台帳」シートと同じ25列・同じ順番。
export interface LedgerRow {
  id: number
  buy_date: string | null
  item_number: string
  kubetsu: string
  hinmoku: string
  name: string
  qty: number
  price_jpy: number | null
  source: string
  note1: string
  note2: string
  confirm_id: string
  partner_address: string
  partner_name: string
  partner_age: string
  partner_job: string
  out_date: string | null
  out_kubun: string
  out_price: number | null
  out_unit: string
  buyer_site: string
  out_confirm_id: string
  buyer_country: string
  buyer_id: string
  buyer_name: string
  buyer_address: string
  origin: string
  sale_line_item_id: string | null
  created_at: string
  updated_at: string
}

export type LedgerField = Exclude<keyof LedgerRow, "id" | "origin" | "sale_line_item_id" | "created_at" | "updated_at">

export const LEDGER_COLUMNS: { key: LedgerField; label: string; group: "受入れ" | "払出し"; kind?: "date" | "number" }[] = [
  { key: "buy_date", label: "年月日", group: "受入れ", kind: "date" },
  { key: "item_number", label: "Item number", group: "受入れ" },
  { key: "kubetsu", label: "区別", group: "受入れ" },
  { key: "hinmoku", label: "品目", group: "受入れ" },
  { key: "name", label: "商品名", group: "受入れ" },
  { key: "qty", label: "数量", group: "受入れ", kind: "number" },
  { key: "price_jpy", label: "代価", group: "受入れ", kind: "number" },
  { key: "source", label: "区分（仕入れ先）", group: "受入れ" },
  { key: "note1", label: "備考1", group: "受入れ" },
  { key: "note2", label: "備考2", group: "受入れ" },
  { key: "confirm_id", label: "確認方法 取引ID", group: "受入れ" },
  { key: "partner_address", label: "相手方 住所", group: "受入れ" },
  { key: "partner_name", label: "相手方 氏名", group: "受入れ" },
  { key: "partner_age", label: "相手方 年齢", group: "受入れ" },
  { key: "partner_job", label: "相手方 職業", group: "受入れ" },
  { key: "out_date", label: "年月日", group: "払出し", kind: "date" },
  { key: "out_kubun", label: "区分", group: "払出し" },
  { key: "out_price", label: "代価", group: "払出し", kind: "number" },
  { key: "out_unit", label: "単位", group: "払出し" },
  { key: "buyer_site", label: "販売先", group: "払出し" },
  { key: "out_confirm_id", label: "確認方法 取引ID", group: "払出し" },
  { key: "buyer_country", label: "国名", group: "払出し" },
  { key: "buyer_id", label: "Buyer ID", group: "払出し" },
  { key: "buyer_name", label: "氏名", group: "払出し" },
  { key: "buyer_address", label: "Address", group: "払出し" },
]
