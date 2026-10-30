// 売上1件の利益計算（画面とAPIで共用）
export const PAYOUT_FEE_RATE = 0.02 // Payoneer等の受取手数料（2%）
export const TAX_FILING_LINE_JPY = 200_000 // 給与所得者の確定申告不要ラインの目安

export interface SaleRow {
  id: string
  line_item_id: string
  order_id: string | null
  item_id: string | null
  title: string | null
  sold_at: string | null
  quantity: number
  sale_usd: number
  shipping_income_usd: number
  ebay_fee_usd: number
  fee_estimated: boolean
  exchange_rate: number
  purchase_cost_jpy: number
  shipping_cost_jpy: number
  other_cost_jpy: number
  memo: string | null
}

export function calcSale(s: SaleRow) {
  const grossUsd = Number(s.sale_usd) + Number(s.shipping_income_usd)
  const afterEbayUsd = grossUsd - Number(s.ebay_fee_usd)
  const payoutFeeUsd = Math.max(afterEbayUsd, 0) * PAYOUT_FEE_RATE
  const netJpy = (afterEbayUsd - payoutFeeUsd) * Number(s.exchange_rate)
  const costJpy =
    Number(s.purchase_cost_jpy) + Number(s.shipping_cost_jpy) + Number(s.other_cost_jpy)
  const profitJpy = Math.round(netJpy - costJpy)
  return {
    grossUsd,
    payoutFeeUsd,
    grossJpy: Math.round(grossUsd * Number(s.exchange_rate)),
    costJpy: Math.round(costJpy),
    profitJpy,
  }
}

// eBay手数料が取れなかったときの推定（最終価値手数料13.25% + 注文ごと$0.40）
export function estimateEbayFeeUsd(grossUsd: number): number {
  return Math.round((grossUsd * 0.1325 + (grossUsd <= 10 ? 0.3 : 0.4)) * 100) / 100
}
