import { NextResponse } from "next/server"

// 試作：Browse API（公式の検索）で、他のセラーの出品が取れるかを確かめる（読み取りのみ）
// /api/research/browse?seller=asatan_japan&q=japan
export const dynamic = "force-dynamic"
export const maxDuration = 60

async function appToken(): Promise<string> {
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
  return j.access_token
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const seller = url.searchParams.get("seller") || "asatan_japan"
    const q = url.searchParams.get("q") || "japan"
    const token = await appToken()
    const params = new URLSearchParams({ q, limit: "50" })
    params.append("filter", `sellers:{${seller}},itemLocationCountry:JP,price:[80..400],priceCurrency:USD`)
    const res = await fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
    })
    const j = await res.json()
    if (!res.ok) return NextResponse.json({ ok: false, status: res.status, error: j?.errors?.[0]?.message ?? j })
    return NextResponse.json({
      ok: true,
      seller,
      q,
      total: j.total,
      samples: (j.itemSummaries ?? []).slice(0, 15).map((it: Record<string, unknown>) => ({
        itemId: String(it.legacyItemId ?? it.itemId),
        title: it.title,
        price: (it.price as { value?: string })?.value,
        condition: it.condition,
        seller: (it.seller as { username?: string })?.username,
      })),
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message })
  }
}
