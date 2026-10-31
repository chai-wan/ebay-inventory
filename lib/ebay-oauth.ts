import crypto from "crypto"
import { createClient } from "@supabase/supabase-js"

// eBayの「ログイン許可」(OAuth) まわり。
// 長期の鍵(refresh token)は暗号化して Supabase の app_tokens に置き、
// 復号の鍵(TOKEN_ENC_KEY)は Vercel の環境変数にだけ置く。

export const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope/sell.finances",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
].join(" ")

const TOKEN_NAME = "ebay_refresh_token"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function encKey(): Buffer {
  const k = process.env.TOKEN_ENC_KEY
  if (!k) throw new Error("TOKEN_ENC_KEY が未設定です")
  return Buffer.from(k, "base64")
}

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv("aes-256-gcm", encKey(), iv)
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()])
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".")
}

function decrypt(packed: string): string {
  const [iv, tag, data] = packed.split(".").map((s) => Buffer.from(s, "base64"))
  const d = crypto.createDecipheriv("aes-256-gcm", encKey(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(data), d.final()]).toString("utf8")
}

function basicAuth(): string {
  const id = process.env.EBAY_CLIENT_ID
  const secret = process.env.EBAY_CLIENT_SECRET
  if (!id || !secret) throw new Error("EBAY_CLIENT_ID / EBAY_CLIENT_SECRET が未設定です")
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64")
}

export function consentUrl(state: string): string {
  const ruName = process.env.EBAY_RUNAME
  if (!ruName) throw new Error("EBAY_RUNAME が未設定です")
  const p = new URLSearchParams({
    client_id: process.env.EBAY_CLIENT_ID ?? "",
    response_type: "code",
    redirect_uri: ruName,
    scope: EBAY_SCOPES,
    state,
  })
  return `https://auth.ebay.com/oauth2/authorize?${p.toString()}`
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    cache: "no-store",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j.error_description || j.error || `token ${res.status}`)
  return j as { access_token: string; refresh_token?: string }
}

export async function exchangeCode(code: string) {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.EBAY_RUNAME ?? "",
  })
}

export async function getEbayUsername(accessToken: string): Promise<string | null> {
  const res = await fetch("https://apiz.ebay.com/commerce/identity/v1/user/", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const j = await res.json()
  return typeof j.username === "string" ? j.username : null
}

export async function saveRefreshToken(token: string) {
  const { error } = await supabase
    .from("app_tokens")
    .upsert({ name: TOKEN_NAME, value: encrypt(token), updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
}

// 連携済みなら短期の鍵(access token)を返す。未連携なら null。
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.from("app_tokens").select("value").eq("name", TOKEN_NAME).maybeSingle()
  if (!data?.value) return null
  const refresh = decrypt(data.value)
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh, scope: EBAY_SCOPES })
  return t.access_token
}

export function timingSafeEqualStr(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}
