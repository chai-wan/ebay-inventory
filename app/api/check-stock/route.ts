import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as cheerio from "cheerio"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// eBay出品を停止する関数
async function endEbayListing(ebayItemId: string) {
  const userToken = process.env.EBAY_USER_TOKEN
  const clientId = process.env.EBAY_CLIENT_ID
  const clientSecret = process.env.EBAY_CLIENT_SECRET

  if (!userToken || !clientId || !clientSecret) return false

  try {
    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${userToken}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${ebayItemId}</ItemID>
  <EndingReason>NotAvailable</EndingReason>
</EndItemRequest>`

    const res = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      headers: {
        "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
        "X-EBAY-API-CALL-NAME": "EndItem",
        "X-EBAY-API-SITEID": "0",
        "Content-Type": "text/xml",
      },
      body: xmlBody,
    })

    const text = await res.text()
    return text.includes("<Ack>Success</Ack>")
  } catch (err) {
    console.error("eBay API エラー:", err)
    return false
  }
}

// eBayのURLからItem IDを抽出する関数
function extractEbayItemId(ebayUrl: string): string | null {
  if (!ebayUrl) return null
  const match = ebayUrl.match(/\/itm\/(\d+)/)
  return match ? match[1] : null
}

export async function GET() {
  try {
    // 監視中の商品を全件取得
    const { data: settings, error } = await supabase
      .from("procurement_settings")
      .select("id, product_url, ebay_url, status, site_name")
      .eq("status", "monitoring")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!settings || settings.length === 0) {
      return NextResponse.json({ message: "監視中の商品なし", checked: 0 })
    }

    // サイトマスタを取得
    const { data: siteMasters } = await supabase
      .from("site_masters")
      .select("site_name, in_stock_keywords, out_of_stock_keywords")

    const results = []

    for (const setting of settings) {
      try {
        const siteMaster = siteMasters?.find(
          (s) => s.site_name === setting.site_name
        )
        const inStockKeywords = siteMaster?.in_stock_keywords
          ? siteMaster.in_stock_keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
          : []
        const outOfStockKeywords = siteMaster?.out_of_stock_keywords
          ? siteMaster.out_of_stock_keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
          : []

        // 商品ページを取得
        const res = await fetch(setting.product_url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(10000),
        })

        const html = await res.text()
        const $ = cheerio.load(html)
        const pageText = $("body").text()

        let newStatus = "monitoring"

        // 在庫なしキーワードが存在する → エラー
        if (outOfStockKeywords.length > 0) {
          const outOfStock = outOfStockKeywords.some((kw: string) =>
            pageText.includes(kw)
          )
          if (outOfStock) newStatus = "error"
        }

        // 在庫ありキーワードが存在しない → エラー
        if (inStockKeywords.length > 0 && newStatus === "monitoring") {
          const inStock = inStockKeywords.some((kw: string) =>
            pageText.includes(kw)
          )
          if (!inStock) newStatus = "error"
        }

        let ebayEnded = false

        // 在庫切れ検知 → eBay出品を停止
        if (newStatus === "error" && setting.ebay_url) {
          const itemId = extractEbayItemId(setting.ebay_url)
          if (itemId) {
            ebayEnded = await endEbayListing(itemId)
          }
        }

        // ステータスが変わった場合のみ更新
        if (newStatus !== setting.status) {
          await supabase
            .from("procurement_settings")
            .update({ status: newStatus })
            .eq("id", setting.id)
        }

        results.push({
          id: setting.id,
          url: setting.product_url,
          status: newStatus,
          ebayEnded,
        })
      } catch (err) {
        await supabase
          .from("procurement_settings")
          .update({ status: "error" })
          .eq("id", setting.id)

        results.push({
          id: setting.id,
          url: setting.product_url,
          status: "error",
          error: String(err),
        })
      }
    }

    return NextResponse.json({
      message: "チェック完了",
      checked: results.length,
      results,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
