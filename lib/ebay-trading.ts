import * as cheerio from "cheerio"

// eBay Trading API (XML) を呼ぶ共通処理。サーバー側専用。
export async function tradingCall(callName: string, innerXml: string) {
  const token = process.env.EBAY_USER_TOKEN
  if (!token) throw new Error("VercelにEBAY_USER_TOKENが設定されていません")
  const body = `<?xml version="1.0" encoding="utf-8"?>
<${callName}Request xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${token}</eBayAuthToken></RequesterCredentials>
  ${innerXml}
</${callName}Request>`
  const res = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    cache: "no-store",
    headers: {
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "X-EBAY-API-CALL-NAME": callName,
      "X-EBAY-API-SITEID": "0",
      "Content-Type": "text/xml",
    },
    body,
  })
  const $ = cheerio.load(await res.text(), { xmlMode: true })
  const ack = $(`${callName}Response > Ack`).text()
  const ok = ack === "Success" || ack === "Warning"
  const error = ok ? null : $("Errors > LongMessage").first().text() || `${callName} に失敗しました`
  return { ok, error, $ }
}
