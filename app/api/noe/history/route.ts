import { NextRequest, NextResponse } from "next/server"
import { loadStateHistory, isPersistenceEnabled } from "@/lib/persistence"

export async function GET(req: NextRequest) {
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10),
    1000
  )
  const history = await loadStateHistory(limit)
  return NextResponse.json({
    count: history.length,
    persistenceEnabled: isPersistenceEnabled(),
    history,
  })
}
