export const dynamic = "force-dynamic";

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Apifyから返ってくるデータ構造の型を定義（Vercelのビルドエラー防止）
interface ApifyScrapedItem {
  url: string;
  html?: string;
  [key: string]: any;
}

async function endEbayListing(ebayItemId: string) {
  const userToken = process.env.EBAY_USER_TOKEN
  const clientId = process.env.EBAY_CLIENT_ID
  const clientSecret = process.env.EBAY_CLIENT_SECRET
  if (!userToken || !clientId || !clientSecret) return false
  try {
    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${userToken}</eBayAuthToken></RequesterCredentials>
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
    return false
  }
}

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

    const { data: settings, error } = await supabase
      .from("procurement_settings")
      .select("id, product_url, ebay_url, status, site_name")
      .eq("status", "monitoring")

    if (error) throw error
    if (!settings || settings.length === 0) {
      return NextResponse.json({ message: "監視中の商品なし", checked: 0 })
    }

    const { data: siteMasters } = await supabase
      .from("site_masters")
      .select("site_name, in_stock_keywords, out_of_stock_keywords")

    const startUrls = settings.map((s) => ({ url: s.product_url }))

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

    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/apify~playwright-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apifyPayload),
      }
    )

    const scrapedItems = await apifyRes.json() as ApifyScrapedItem[]
    const results = []

    const globalDebug = {
      isResponseArray: Array.isArray(scrapedItems),
      scrapedCount: Array.isArray(scrapedItems) ? scrapedItems.length : 0,
      allScrapedUrls: Array.isArray(scrapedItems) ? scrapedItems.map(item => item.url) : []
    }

    for (const setting of settings) {
      try {
        const siteMaster = siteMasters?.find((s) => s.site_name === setting.site_name)
        const inStockKeywords = siteMaster?.in_stock_keywords
          ? siteMaster.in_stock_keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
          : []
        const outOfStockKeywords = siteMaster?.out_of_stock_keywords
          ? siteMaster.out_of_stock_keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
          : []

        const scrapedData = Array.isArray(scrapedItems) 
          ? scrapedItems.find((item) => item && item.url && (item.url.includes(setting.product_url) || setting.product_url.includes(item.url)))
          : null

        let newStatus = "monitoring"
        let debugInfo = {
          foundData: !!scrapedData,
          matchedUrl: scrapedData ? scrapedData.url : null,
          htmlLength: scrapedData?.html ? scrapedData.html.length : 0,
          hasSoldOutKw: false,
          hasOnSaleKw: false,
          hasAnyText: false
        }

        if (!scrapedData || !scrapedData.html) {
           newStatus = "error"
        } else {
           const html = scrapedData.html
           debugInfo.hasSoldOutKw = html.includes("ITEM_STATUS_SOLD_OUT") || html.includes("http://schema.org/OutOfStock") || html.includes("売り切れ")
           debugInfo.hasOnSaleKw = html.includes("ITEM_STATUS_ON_SALE") || html.includes("http://schema.org/InStock") || html.includes("購入手続きへ")
           debugInfo.hasAnyText = html.length > 200

           if (setting.site_name === "mercari") {
             if (debugInfo.hasSoldOutKw) {
               newStatus = "error"
             } else if (debugInfo.hasOnSaleKw) {
               newStatus = "monitoring"
             } else {
               newStatus = "error"
             }
           } else {
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
        if (newStatus === "error" && setting.ebay_url) {
          const itemId = extractEbayItemId(setting.ebay_url)
          if (itemId) {
            ebayEnded = await endEbayListing(itemId)
          }
        }

        if (newStatus !== setting.status) {
          await supabase.from("procurement_settings").update({ status: newStatus }).eq("id", setting.id)
        }

        results.push({ 
          id: setting.id, 
          url: setting.product_url, 
          status: newStatus, 
          ebayEnded,
          itemDebug: debugInfo 
        })
      } catch (err) {
        results.push({ id: setting.id, status: "error", error: String(err) })
      }
    }

    return NextResponse.json({ message: "チェック完了", checked: results.length, globalDebug, results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
