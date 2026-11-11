import ExcelJS from "exceljs"
import { serverSupabase } from "@/lib/supabase-server"
import { LEDGER_COLUMNS, type LedgerRow } from "@/lib/ledger"

// 古物台帳をExcel（元のExcelと同じ並びの「古物台帳」シート）で返す。
// 画面の「Excelで保存」（ログイン必須）と、月1のバックアップ（LEDGER_BACKUP_SECRET）から呼ぶ。
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  const supabase = serverSupabase()
  const rows: LedgerRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("kobutsu_ledger")
      .select("*")
      .order("buy_date", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(from, from + 999)
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })
    rows.push(...((data ?? []) as LedgerRow[]))
    if (!data || data.length < 1000) break
  }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("古物台帳", { views: [{ state: "frozen", ySplit: 3 }] })
  const inCount = LEDGER_COLUMNS.filter((c) => c.group === "受入れ").length
  ws.getCell(1, 1).value = "古物台帳"
  ws.getCell(2, 1).value = "受入れ"
  ws.getCell(2, inCount + 1).value = "払出し"
  ws.getRow(3).values = LEDGER_COLUMNS.map((c) => c.label)
  ws.getRow(3).font = { bold: true }
  ws.getRow(2).font = { bold: true }

  for (const r of rows) {
    ws.addRow(
      LEDGER_COLUMNS.map((c) => {
        const v = r[c.key]
        if (v === null || v === undefined || v === "") return null
        if (c.kind === "date") return new Date(`${v}T00:00:00+09:00`)
        if (c.kind === "number") return Number(v)
        return v
      })
    )
  }
  LEDGER_COLUMNS.forEach((c, i) => {
    const col = ws.getColumn(i + 1)
    col.width = c.key === "name" ? 40 : c.key.endsWith("address") || c.key === "note1" ? 30 : c.kind === "date" ? 12 : 14
    if (c.kind === "date") col.numFmt = "yyyy/mm/dd"
  })

  const buf = await wb.xlsx.writeBuffer()
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  return new Response(buf as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="kobutsu-ledger-${today}.xlsx"`,
      "x-row-count": String(rows.length),
    },
  })
}
