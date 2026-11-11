// 型番の抜き出しと、eBay検索語の作成（画面とサーバーの両方から使う。秘密情報は扱わない）

// タイトルから型番らしい文字列を抜き出す（例：DOL-015, ICF-7600DA, MZ-RH1）
const SKIP = /^(VOL|NO|EP|LP|CD|DVD|BD|NTSC|PAL|SIZE|SET|VER|USB|AC|DC|MK|MKII|LOT|PCS|PC|CM|MM|KG|JP|JPN|ITEM|TYPE|SERIES|BOX)[-]?\d*$/
export function extractModel(title: string): string | null {
  const t = title.toUpperCase().replace(/[‐－―]/g, "-")
  const found = t.match(/\b[A-Z]{1,6}-?[A-Z]{0,3}\d{1,5}[A-Z0-9]{0,4}(?:-[A-Z0-9]{1,4})?\b/g) ?? []
  const cands = found.filter((m) => {
    if (SKIP.test(m)) return false
    if (m.includes("-")) return true
    const letters = (m.match(/^[A-Z]+/) ?? [""])[0].length
    const digits = (m.match(/\d/g) ?? []).length
    // 「F2」「F1」のような絞り値などを除く：ハイフンなしなら、文字2つ以上か数字3つ以上
    return m.length >= 3 && (letters >= 2 || digits >= 3)
  })
  if (cands.length === 0) return null
  return cands.sort((a, b) => b.length - a.length)[0]
}

// 先頭にあってもブランドではない語（「Vintage SONY ICF-…」の Vintage など）
const NOT_BRAND = /^(VINTAGE|RARE|NEW|USED|JUNK|JAPAN|JAPANESE|JPN|JP|OFFICIAL|GENUINE|LOT|SET|F\/S|FREE|MINT|EXC|EXCELLENT|NEAR|BOXED|SEALED|LIMITED|\[.*\]|\(.*\))$/i

// 一覧の「安い順」リンク用の検索語：ブランド（先頭の語）＋型番。型番が取れなければ空
export function keywordFromTitle(title: string): string {
  const model = extractModel(title)
  if (!model) return ""
  const brand = title.trim().split(/\s+/).find((w) => !NOT_BRAND.test(w)) ?? ""
  return brand && brand.toUpperCase() !== model ? `${brand} ${model}` : model
}
