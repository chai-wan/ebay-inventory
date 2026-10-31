import { NextResponse } from "next/server"
import crypto from "crypto"
import { consentUrl } from "@/lib/ebay-oauth"

export const dynamic = "force-dynamic"

// eBayのログイン許可画面へ移動する
export async function GET() {
  try {
    const state = crypto.randomBytes(16).toString("hex")
    const res = NextResponse.redirect(consentUrl(state))
    res.cookies.set("ebay_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" })
    return res
  } catch (e) {
    return new NextResponse(`設定が足りません：${(e as Error).message}`, { status: 500 })
  }
}
