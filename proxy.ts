import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AUTH_COOKIE, safeEqual, sessionToken } from "@/lib/auth"

// パスワード未入力ならログイン画面へ。APP_PASSWORD が未設定のときは保護しない（締め出し防止）。
export async function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD
  if (!password) return NextResponse.next()

  // Vercelの定時実行（売上の自動取り込み）は CRON_SECRET で通す
  const cronSecret = process.env.CRON_SECRET
  if (
    cronSecret &&
    (req.nextUrl.pathname === "/api/import-sales" || req.nextUrl.pathname === "/api/research/step" || req.nextUrl.pathname === "/api/ledger/fill-sales") &&
    req.headers.get("authorization") === `Bearer ${cronSecret}`
  ) {
    return NextResponse.next()
  }

  // 月1の台帳バックアップ（GitHubの非公開リポジトリ ebay-ledger-backup のActionsから）は LEDGER_BACKUP_SECRET で通す
  const backupSecret = process.env.LEDGER_BACKUP_SECRET
  if (
    backupSecret &&
    req.nextUrl.pathname === "/api/ledger/export" &&
    req.headers.get("authorization") === `Bearer ${backupSecret}`
  ) {
    return NextResponse.next()
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value ?? ""
  if (cookie && safeEqual(cookie, await sessionToken(password))) return NextResponse.next()

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "ログインが必要です" }, { status: 401 })
  }
  const url = req.nextUrl.clone()
  url.pathname = "/login"
  url.search = ""
  return NextResponse.redirect(url)
}

export const config = {
  // ログイン画面、eBayからの戻り先、プライバシーポリシー、アイコン類は対象外
  matcher: [
    "/((?!login|api/login|api/ebay-oauth/callback|privacy|_next/|manifest.webmanifest|favicon|icon|apple-icon|app-icon|.*\\.(?:png|svg|jpg|ico)$).*)",
  ],
}
