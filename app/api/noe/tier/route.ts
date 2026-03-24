import { NextRequest, NextResponse } from "next/server"
import { getTokenBalance } from "@/lib/solana"
import { getTier, getCaps, TIER_THRESHOLDS, TIER_LABELS } from "@/lib/noe-tiers"

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet")
  if (!wallet) {
    return NextResponse.json({ error: "wallet param required" }, { status: 400 })
  }

  const balance = await getTokenBalance(wallet)
  const tier = getTier(balance)
  const caps = getCaps(balance)

  return NextResponse.json({
    wallet,
    balance,
    tier,
    tierLabel: TIER_LABELS[tier],
    capabilities: caps,
    thresholds: TIER_THRESHOLDS,
  })
}
