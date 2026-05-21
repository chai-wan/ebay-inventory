import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// 【重要】複数商品のブラウザチェックに時間がかかるため、Vercelの待機時間を最大(60秒)に延長
export const maxDuration = 60;

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
    const apifyToken = process.env.APIFY_API_TOKEN
    if (!apifyToken) {
      return NextResponse.json({ error: "Apifyトークンが設定されていません" }, { status: 500 })
    }

    // 監視中の商品を全件取得
    const { data: settings, error } = await supabase
      .from("procurement_settings")
      .select("id, product_url, ebay_url, status, site_name")
      .eq("status", "monitoring")

    if (error) throw error

    if (!settings || settings.length === 0) {
      return NextResponse.json({ message: "監視中の商品なし", checked: 0 })
    }

    // サイトマスタを取得
    const { data: siteMasters } = await supabase
      .from("site_masters")
      .select("site_name, in_stock_keywords, out_of_stock_keywords")

    // === 1. Apifyにまとめてチェックを依頼 ===
    const startUrls = settings.map((s) => ({ url: s.product_url }))

    // Playwright（ブラウザ自動操作）の設定
    const apifyPayload = {
      startUrls,
      pageFunction: `
        async function pageFunction(context) {
          const { request, page } = context;
          await page.waitForLoadState('domcontentloaded');
          const html = await page.content();
          return { url: request.url, html: html };
        }
      `,
      proxyConfiguration: { useApifyProxy: true }
    }

    // Apify APIを同期実行（結果が出るまで待つ）
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/apify~playwright-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apifyPayload),
      }
    )

    const scrapedItems = await apifyRes.json()
    if (!Array.isArray(scrapedItems)) {
      throw new Error("Apifyからのデータ取得に失敗しました")
    }

    const results = []

    // === 2. 取得したHTMLから在庫を判定し、SupabaseとeBayを更新 ===
    for (const setting of settings) {
      try {
        const siteMaster = siteMasters?.find((s) => s.site_name === setting.site_name)
        const inStockKeywords = siteMaster?.in_stock_keywords
          ? siteMaster.in_stock_keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
          : []
        const outOfStockKeywords = siteMaster?.out_of_stock_keywords
          ? siteMaster.out_of_stock_keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
          : []

        // URLパラメータ違いなどを考慮して前方一致で検索
        const scrapedData = scrapedItems.find((item) => item.url.startsWith(setting.product_url))
        let newStatus = "monitoring"

        if (!scrapedData || !scrapedData.html) {
           newStatus = "error" // 取れなかった場合は安全のためエラー
        } else {
           const html = scrapedData.html

           if (setting.site_name === "mercari") {
             if (html.includes("ITEM_STATUS_SOLD_OUT") || html.includes("http://schema.org/OutOfStock")) {
               newStatus = "error"
             } else if (html.includes("ITEM_STATUS_ON_SALE") || html.includes("http://schema.org/InStock")) {
               newStatus = "monitoring"
             } else {
               newStatus = "error" 
             }
           } else {
             // メルカリ以外はサイトマスタのキーワード検索
             if (outOfStockKeywords.length > 0) {
               const outOfStock = outOfStockKeywords.some((kw: string) => html.includes(kw))
               if (outOfStock) newStatus = "error"
             }
             if (inStockKeywords.length > 0 && newStatus === "monitoring") {
               const inStock = inStockKeywords.some((kw: string) => html.includes(kw))
               if (!inStock) newStatus = "error"
             }
           }
        }

        let ebayEnded = false

        // 在庫切れ検知 → eBay出品を停止
        if (newStatus === "error" && setting.ebay_url) {
          const itemId = extractEbayItemId(setting.ebay_url)
          if (itemId) {
            ebayEnded = await endEbayListing(itemId)
          }
        }

        if (newStatus !== setting.status) {
          await supabase
            .from("procurement_settings")
            .update({ status: newStatus })
            .eq("id", setting.id)
        }

        results.push({ id: setting.id, url: setting.product_url, status: newStatus, ebayEnded })
      } catch (err) {
        results.push({ id: setting.id, status: "error", error: String(err) })
      }
    }

    return NextResponse.json({ message: "チェック完了", checked: results.length, results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
