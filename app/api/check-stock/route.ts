// deploy trigger
// cache bust 3
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import * as cheerio from "cheerio"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// eBay出品を停止する関数
async function endEbayListing(ebayItemId: string): Promise<boolean> {
  const userToken = process.env.EBAY_USER_TOKEN
  if (!userToken) return false
  try {
    const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${userToken}</eBayAuthToken></RequesterCredentials>
  <ItemID>${ebayItemId}</ItemID>
  <EndingReason>NotAvailable</EndingReason>
</EndItemRequest>`
    const res = await fetch("https://api.ebay.com/ws/api.dll", {
      method: "POST",
      cache: "no-store",
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
  } catch {
    return false
  }
}

function extractEbayItemId(ebayUrl: string): string | null {
  if (!ebayUrl) return null
  const match = ebayUrl.match(/\/itm\/(\d+)/)
  return match ? match[1] : null
}

// 在庫判定ロジック
function checkStockStatus(html: string, siteName: string, inStockKeywords: string[], outOfStockKeywords: string[]): "monitoring" | "error" {

  // 在庫なしキーワードが見つかった場合のみerror（安全側の判定）
  // メルカリ専用キーワード
  if (siteName === "mercari") {
    if (html.includes('"availability":"http://schema.org/OutOfStock"') ||
        html.includes('"availability": "http://schema.org/OutOfStock"') ||
        html.includes("ITEM_STATUS_SOLD_OUT") ||
        html.includes('"status":"SOLD_OUT"') ||
        html.includes("sold-out")) {
      return "error"
    }
    // 在庫ありキーワードが見つかればmonitoring
    if (html.includes('"availability":"http://schema.org/InStock"') ||
        html.includes('"availability": "http://schema.org/InStock"') ||
        html.includes("ITEM_STATUS_ON_SALE") ||
        html.includes('"status":"ON_SALE"')) {
      return "monitoring"
    }
    // どちらも見つからない場合はmonitoringのまま（誤検知を防ぐ）
    return "monitoring"
  }

  // その他サイト：在庫なしキーワードが見つかった場合のみerror
  if (outOfStockKeywords.length > 0) {
    const outOfStock = outOfStockKeywords.some(kw => html.includes(kw))
    if (outOfStock) return "error"
  }
  // 在庫ありキーワードが設定されている場合、見つからなければerror
  if (inStockKeywords.length > 0) {
    const inStock = inStockKeywords.some(kw => html.includes(kw))
    if (!inStock) return "error"
  }
  return "monitoring"
}

export async function GET() {
  try {
    // 監視中の商品を全件取得
    const { data: settings, error } = await supabase
      .from("procurement_settings")
      .select("id, product_url, ebay_url, status, site_name")
      .eq("status", "monitoring")

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
        const siteMaster = siteMasters?.find(s => s.site_name === setting.site_name)
        const inStockKeywords = siteMaster?.in_stock_keywords
          ? siteMaster.in_stock_keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
          : []
        const outOfStockKeywords = siteMaster?.out_of_stock_keywords
          ? siteMaster.out_of_stock_keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
          : []

        // 商品ページを取得（キャッシュ無効化）
        const res = await fetch(setting.product_url, {
          cache: "no-store",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          signal: AbortSignal.timeout(15000),
        })

        const html = await res.text()
        const $ = cheerio.load(html)

        // デバッグ用：HTML内の重要なキーワードをログ出力
        const debugInfo = {
          hasInStock: html.includes("InStock"),
          hasOutOfStock: html.includes("OutOfStock"),
          hasOnSale: html.includes("ITEM_STATUS_ON_SALE"),
          hasSoldOut: html.includes("ITEM_STATUS_SOLD_OUT"),
          htmlLength: html.length,
        }
        console.log(`[check-stock] ${setting.site_name}:`, debugInfo)

        const newStatus = checkStockStatus(html, setting.site_name, inStockKeywords, outOfStockKeywords)

        let ebayEnded = false
        if (newStatus === "error" && setting.ebay_url) {
          const itemId = extractEbayItemId(setting.ebay_url)
          if (itemId) ebayEnded = await endEbayListing(itemId)
        }

        if (newStatus !== setting.status) {
          await supabase
            .from("procurement_settings")
            .update({ status: newStatus })
            .eq("id", setting.id)
        }

        results.push({
          id: setting.id,
          site: setting.site_name,
          url: setting.product_url,
          status: newStatus,
          ebayEnded,
          debug: debugInfo,
        })
      } catch (err) {
        await supabase
          .from("procurement_settings")
          .update({ status: "error" })
          .eq("id", setting.id)
        results.push({ id: setting.id, status: "error", error: String(err) })
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
