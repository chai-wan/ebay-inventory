// アプリのパスワード保護（Cookieで180日間ログインを保つ）
export const AUTH_COOKIE = "app_session"
export const AUTH_MAX_AGE = 60 * 60 * 24 * 180

// パスワードから作る合言葉（パスワードを変えると全員ログアウトされる）
export async function sessionToken(password: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("ebay-inventory-session-v1"))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
