import { NextResponse } from "next/server"
import { AUTH_COOKIE, AUTH_MAX_AGE, safeEqual, sessionToken } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const password = process.env.APP_PASSWORD
  if (!password) return NextResponse.json({ ok: true })
  const { input } = await req.json().catch(() => ({ input: "" }))
  // 総当たり対策に少し待たせる
  await new Promise((r) => setTimeout(r, 600))
  if (typeof input !== "string" || !safeEqual(input, password)) {
    return NextResponse.json({ ok: false, error: "パスワードが違います" }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE, await sessionToken(password), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: AUTH_MAX_AGE,
    path: "/",
  })
  return res
}
