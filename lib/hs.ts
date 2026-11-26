// HSコード（関税番号）の注意チェック。
// 米国向けDDPでは、インボイスのHSコードによって追加関税（Section 232 など）が自動で上乗せされる。
// 2026-09 の Victor JX-53 で 8537.10.9170 を使い、自動車部品15%＋無人航空機100%が上乗せされた
// （申告$108に対し関税$137.70）。ここには「確かに追加関税の対象」と分かっている番号だけを入れる。
// リストは網羅ではない。追加関税の対象は随時変わるので、新しく分かったら足す。

export type HsCheck = {
  level: "danger" | "caution" | "ok" | "empty"
  message: string
}

type Rule = { prefix: string; level: "danger" | "caution"; message: string }

// prefix は数字だけ（ドットなし）で前方一致
const RULES: Rule[] = [
  // Section 232 無人航空機（Proclamation 11055、2026-09-03〜）。Annex IV (1) で100%
  { prefix: "8537109170", level: "danger", message: "ドローン部品100%＋自動車部品15%の追加関税（JX-53で実際に請求された番号）" },
  { prefix: "8504409580", level: "danger", message: "ドローン関連100%の追加関税の対象" },
  { prefix: "8806", level: "danger", message: "無人航空機（ドローン）本体。25〜100%の追加関税" },
  { prefix: "8807", level: "danger", message: "ドローン・航空機の部品。追加関税の対象（2027-02から範囲拡大）" },
  // 8537（制御盤・配電盤）は他の細分も自動車部品などの追加関税に入っている可能性がある（推測）
  { prefix: "8537", level: "caution", message: "制御盤・配電盤の番号。追加関税の対象が多い分類。オーディオ機器なら別の番号が合うことが多い" },
]

export function normalizeHs(code: string | null | undefined): string {
  return (code ?? "").replace(/[^0-9]/g, "")
}

export function checkHsCode(code: string | null | undefined): HsCheck {
  const d = normalizeHs(code)
  if (!d) return { level: "empty", message: "" }
  for (const r of RULES) {
    if (d.startsWith(r.prefix)) return { level: r.level, message: r.message }
  }
  if (d.length !== 10) return { level: "caution", message: `CPaSSはドットなし10桁が必須です（今は${d.length}桁）` }
  // 6桁に0を足しただけの10桁（例 8537100000）は、米国の関税表にない番号のことが多く、税関側が番号を選び直す
  if (d.endsWith("0000")) return { level: "caution", message: "末尾が0000です。6桁に0を足しただけだと、米国の関税表にない番号になり、税関が別の番号を選ぶことがあります（JX-53はこれで8537.10.9170になった）" }
  return { level: "ok", message: "既知の追加関税リストには該当なし（リストは網羅ではありません）" }
}
