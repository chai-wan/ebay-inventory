"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock } from "lucide-react"

export default function LoginPage() {
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const j = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input }),
    })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "通信エラー" }))
    if (j.ok) window.location.href = "/"
    else {
      setError(j.error)
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold">ログイン</h1>
        </div>
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="パスワード"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !input}>
          {busy ? "確認中…" : "ログイン"}
        </Button>
        <p className="text-xs text-muted-foreground">一度ログインすると、この端末では180日間そのまま使えます。</p>
      </form>
    </main>
  )
}
