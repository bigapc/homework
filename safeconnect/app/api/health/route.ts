import { NextResponse } from "next/server"
import { getHealthEnvSummary } from "@/lib/env"

export const runtime = "nodejs"

export async function GET() {
  const envSummary = getHealthEnvSummary()

  return NextResponse.json({
    status: "ok",
    app: "safeconnect",
    version: "phase3",
    timestamp: new Date().toISOString(),
    env: envSummary,
  })
}
