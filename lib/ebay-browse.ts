// eBay Browse API（公式の検索）。アプリ用トークン（client credentials）で呼ぶ。読み取りのみ。
let cached: { token: string; exp: number } | null = null

export async function browseAppToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token
  const id = process.env.EBAY_CLIENT_ID
  const secret = process.env.EBAY_CLIENT_SECRET
  if (!id || !secret) throw new Error("EBAY_CLIENT_ID / EBAY_CLIENT_SECRET が未設定です")
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "https://api.ebay.com/oauth/api_scope" }).toString(),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j.error_description || j.error || `token ${res.status}`)
  cached = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 7200) * 1000 }
  return cached.token
}

export interface BrowseSummary {
  itemId: string
  title: string
  price: number
  condition: string
  seller: string
  created: string | null
  shipping: number | null // 米国への送料（分からなければ null）
  url: string
}

export async function browseSearch(params: Record<string, string>, filters: string[]) {
  const token = await browseAppToken()
  const q = new URLSearchParams(params)
  if (filters.length) q.append("filter", filters.join(","))
  const res = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${q.toString()}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
  })
  const j = await res.json()
  if (!res.ok) return { ok: false as const, error: String(j?.errors?.[0]?.message ?? res.status), total: 0, items: [] as BrowseSummary[] }
  const items: BrowseSummary[] = (j.itemSummaries ?? []).map((it: Record<string, any>) => ({
    itemId: String(it.legacyItemId ?? it.itemId ?? ""),
    title: String(it.title ?? ""),
    price: Number(it.price?.value) || 0,
    condition: String(it.condition ?? ""),
    seller: String(it.seller?.username ?? ""),
    created: it.itemCreationDate ? String(it.itemCreationDate) : null,
    shipping: it.shippingOptions?.[0]?.shippingCost?.value != null ? Number(it.shippingOptions[0].shippingCost.value) : null,
    url: String(it.itemWebUrl ?? ""),
  }))
  return { ok: true as const, error: null, total: Number(j.total) || 0, items }
}
