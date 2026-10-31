import { NextRequest, NextResponse } from "next/server"
import { exchangeCode, getEbayUsername, saveRefreshToken, timingSafeEqualStr } from "@/lib/ebay-oauth"

export const dynamic = "force-dynamic"

// 自分のeBayアカウント以外で許可されたら保存しない
const EXPECTED_USER = process.env.EBAY_EXPECTED_USER || "kaikaido-japan"

function page(title: string, msg: string, status = 200) {
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head><body style="font-family:system-ui,sans-serif;padding:24px;line-height:1.7">
<h1 style="font-size:20px">${title}</h1><p>${msg}</p><p><a href="/">アプリに戻る</a></p></body></html>`
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state") ?? ""
  const saved = req.cookies.get("ebay_oauth_state")?.value ?? ""

  if (!code) return page("連携をやめました", "eBayで許可されなかったか、途中で戻りました。", 400)
  if (!saved || !timingSafeEqualStr(state, saved)) {
    return page("連携できませんでした", "確認用の情報が一致しません。アプリからもう一度やり直してください。", 400)
  }

  try {
    const t = await exchangeCode(code)
    if (!t.refresh_token) throw new Error("長期の鍵が返ってきませんでした")
    const user = await getEbayUsername(t.access_token)
    if (user !== EXPECTED_USER) {
      return page("連携できませんでした", `許可したアカウント（${user ?? "不明"}）が想定と違うため保存しませんでした。`, 403)
    }
    await saveRefreshToken(t.refresh_token)
    const res = page("eBayと連携できました", "アプリの「売上」タブで「eBayから取り込む」を押すと、手数料の実額が入ります。")
    res.cookies.delete("ebay_oauth_state")
    return res
  } catch (e) {
    return page("連携できませんでした", `エラー：${(e as Error).message}`, 500)
  }
}
