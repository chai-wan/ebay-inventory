// eBay SpeedPAK Japan – Ship via FedEx（Orange Connex）の送料計算
// 出典：RATE GUIDE 2026（発効日 2026-10-23）の International Connect Plus (FICP)、基本料金（円）。
// 列：Zone E = アメリカ西部（USW）、Zone F = アメリカ東部・その他／カナダ（USE/CA）。
// 料金表が改定されたら、この表を差し替える。
//
// ルール（料金表の備考より）
// - 課金重量 = 実重量 と 寸法重量（長さ×幅×高さ cm ÷ 5,000）の大きい方
// - 寸法の小数は次の整数cmに切り上げ、重量は表の次の段に切り上げ
// - 基本料金のほかに燃料割増金などがかかる（率は毎週変わるので設定で持つ）

// [課金重量kg, 西部(USW), 東部・カナダ(USE/CA)]
const FICP_US: [number, number, number][] = [
  [0.5, 2082, 2115],
  [1, 2558, 2599],
  [1.5, 2797, 2840],
  [2, 3061, 3108],
  [2.5, 3328, 3383],
  [3, 3492, 3540],
  [3.5, 3549, 3593],
  [4, 3973, 4022],
  [4.5, 4395, 4451],
  [5, 4718, 4718],
  [5.5, 5043, 5043],
  [6, 5366, 5366],
  [6.5, 5734, 5735],
  [7, 6183, 6184],
  [7.5, 6575, 6683],
  [8, 6761, 6871],
  [8.5, 6947, 7060],
  [9, 7131, 7249],
  [9.5, 8735, 8865],
  [10, 8958, 9089],
  [10.5, 9195, 9346],
  [11, 9432, 9602],
  [11.5, 9672, 9861],
  [12, 9910, 10116],
  [12.5, 11323, 11439],
  [13, 11589, 11723],
  [13.5, 11854, 12006],
  [14, 12120, 12289],
  [14.5, 12385, 12573],
  [15, 12650, 12857],
  [15.5, 12915, 13140],
  [16, 14544, 14631],
  [16.5, 14837, 14940],
  [17, 15129, 15249],
  [17.5, 15422, 15559],
  [18, 15715, 15867],
  [18.5, 16007, 16177],
  [19, 16300, 16485],
  [19.5, 16594, 16794],
  [20, 16887, 17104],
  [21, 19070, 20625],
  [22, 20035, 21657],
  [23, 21000, 22689],
  [24, 21966, 23721],
  [25, 22929, 24754],
  [26, 23895, 25787],
  [27, 24860, 26819],
  [28, 25825, 27852],
  [29, 26790, 28885],
  [30, 27754, 29916],
  [31, 28720, 30950],
  [32, 29684, 31983],
  [33, 31582, 34201],
  [34, 32539, 35237],
  [35, 33496, 36274],
  [36, 34453, 37310],
  [37, 35410, 38346],
  [38, 36367, 39383],
  [39, 37324, 40419],
  [40, 38281, 41455],
  [41, 39239, 42492],
  [42, 40196, 43528],
  [43, 41153, 44565],
  [44, 42110, 45601],
  [45, 42110, 45624],
  [46, 42110, 45624],
  [47, 42110, 45624],
  [48, 42110, 45792],
  [49, 42364, 46746],
  [50, 43229, 47700],
  [51, 44094, 48654],
  [52, 44958, 49608],
  [53, 45823, 50562],
  [54, 46687, 51516],
  [55, 47552, 52470],
  [56, 48416, 53424],
  [57, 49281, 54378],
  [58, 50146, 55332],
  [59, 51010, 56286],
  [60, 51875, 57240],
  [61, 52739, 58194],
  [62, 53604, 59148],
  [63, 54469, 60102],
  [64, 55333, 61056],
  [65, 56198, 62010],
  [66, 57062, 62964],
  [67, 57927, 63918],
  [68, 58791, 64872],
]

export type UsZone = "usw" | "use"

export interface ShippingInput {
  weightKg: number
  lengthCm?: number
  widthCm?: number
  heightCm?: number
  zone?: UsZone
  fuelPct?: number
}

export interface ShippingResult {
  billableKg: number // 料金表の段に切り上げた課金重量
  volumetricKg: number
  baseJpy: number
  fuelJpy: number
  totalJpy: number
  overMax: boolean // 68kg超
}

export function calcSpeedpakFedexJpy(input: ShippingInput): ShippingResult | null {
  const w = Number(input.weightKg) || 0
  if (w <= 0) return null
  const l = Math.ceil(Number(input.lengthCm) || 0)
  const wd = Math.ceil(Number(input.widthCm) || 0)
  const h = Math.ceil(Number(input.heightCm) || 0)
  const volumetricKg = l && wd && h ? (l * wd * h) / 5000 : 0
  const chargeable = Math.max(w, volumetricKg)
  const row = FICP_US.find(([kg]) => kg >= chargeable - 1e-9)
  if (!row) {
    return { billableKg: chargeable, volumetricKg, baseJpy: 0, fuelJpy: 0, totalJpy: 0, overMax: true }
  }
  const baseJpy = input.zone === "usw" ? row[1] : row[2]
  const fuelJpy = Math.round((baseJpy * (Number(input.fuelPct) || 0)) / 100)
  return { billableKg: row[0], volumetricKg, baseJpy, fuelJpy, totalJpy: baseJpy + fuelJpy, overMax: false }
}
