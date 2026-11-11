import type { NextRequest } from "next/server"

// 画面からDBへの中継。proxy.ts でログイン済みのときだけここまで来る。
// REST（/rest/v1/...）だけを通し、合言葉ヘッダーを付けてSupabaseへ渡す。
export const dynamic = "force-dynamic"

const PASS_REQ = ["accept", "accept-profile", "content-profile", "content-type", "prefer", "range", "range-unit", "x-client-info", "apikey", "authorization"]
const PASS_RES = ["content-type", "content-range", "preference-applied", "location"]

async function forward(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  if (path[0] !== "rest" || path[1] !== "v1") {
    return Response.json({ ok: false, error: "not allowed" }, { status: 404 })
  }
  const target = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`
  const headers = new Headers()
  for (const h of PASS_REQ) {
    const v = req.headers.get(h)
    if (v) headers.set(h, v)
  }
  headers.set("x-db-gate", process.env.DB_GATE_SECRET ?? "")
  const hasBody = !["GET", "HEAD"].includes(req.method)
  const res = await fetch(target, {
    method: req.method,
    headers,
    body: hasBody ? await req.text() : undefined,
    cache: "no-store",
  })
  const out = new Headers()
  for (const h of PASS_RES) {
    const v = res.headers.get(h)
    if (v) out.set(h, v)
  }
  return new Response(res.status === 204 ? null : await res.arrayBuffer(), { status: res.status, headers: out })
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE }
