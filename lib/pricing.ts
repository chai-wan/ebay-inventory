// 出品価格と利益の計算に使う設定（画面の「計算の設定」で変更でき、app_tokens の pricing_settings に保存）
export interface PricingSettings {
  ebayFeePct: number // eBay手数料の合計率（最終価値手数料＋国際手数料＋広告など）
  payoutFeePct: number // 受取手数料
  fuelPct: number // FedExの燃料割増金（毎週変わる）
  dutyPct: number // 自分が負担する関税・輸入税の率（売値に対する%）。買い手負担なら0
  zone: "usw" | "use" // 送料の計算に使うアメリカの地域（東部の方が少し高い）
  targetProfitJpy: number // 目標利益（必要な売値の計算に使う）
}

// 既定値。eBay手数料はこれまでの実額（約18%）から。燃料割増金と関税は仮の値なので、請求書で確認して直す
export const DEFAULT_PRICING: PricingSettings = {
  ebayFeePct: 18,
  payoutFeePct: 2,
  fuelPct: 30,
  dutyPct: 0,
  zone: "use",
  targetProfitJpy: 2000,
}

export function mergePricing(v: unknown): PricingSettings {
  const o = (v && typeof v === "object" ? v : {}) as Partial<PricingSettings>
  const n = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d)
  return {
    ebayFeePct: n(o.ebayFeePct, DEFAULT_PRICING.ebayFeePct),
    payoutFeePct: n(o.payoutFeePct, DEFAULT_PRICING.payoutFeePct),
    fuelPct: n(o.fuelPct, DEFAULT_PRICING.fuelPct),
    dutyPct: n(o.dutyPct, DEFAULT_PRICING.dutyPct),
    zone: o.zone === "usw" ? "usw" : "use",
    targetProfitJpy: n(o.targetProfitJpy, DEFAULT_PRICING.targetProfitJpy),
  }
}

export interface ListingCost {
  purchaseJpy: number // 仕入れ（割引後）
  shippingJpy: number // 国際送料
  otherJpy: number // 関税など、その他の手入力費用
}

// 売値（＋買い手が払う送料）での利益（円）
export function listingProfitJpy(
  priceUsd: number,
  buyerShippingUsd: number,
  rate: number,
  cost: ListingCost,
  s: PricingSettings
): number {
  const keep = (1 - s.ebayFeePct / 100) * (1 - s.payoutFeePct / 100)
  const netJpy = (priceUsd + buyerShippingUsd) * keep * rate
  const dutyJpy = priceUsd * rate * (s.dutyPct / 100)
  return Math.round(netJpy - dutyJpy - cost.purchaseJpy - cost.shippingJpy - cost.otherJpy)
}

// 目標利益を出すのに必要な売値（ドル）
export function requiredPriceUsd(
  targetJpy: number,
  buyerShippingUsd: number,
  rate: number,
  cost: ListingCost,
  s: PricingSettings
): number | null {
  const keep = (1 - s.ebayFeePct / 100) * (1 - s.payoutFeePct / 100)
  const perDollar = rate * (keep - s.dutyPct / 100)
  if (perDollar <= 0) return null
  const need = targetJpy + cost.purchaseJpy + cost.shippingJpy + cost.otherJpy - buyerShippingUsd * keep * rate
  return Math.max(0, Math.ceil((need / perDollar) * 100) / 100)
}
