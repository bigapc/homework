import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "safeconnect",
    version: "phase3",
    timestamp: new Date().toISOString(),
    env: {
      supabasePublicConfigured:
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      twilioConfigured:
        Boolean(process.env.TWILIO_ACCOUNT_SID) &&
        Boolean(process.env.TWILIO_AUTH_TOKEN) &&
        Boolean(process.env.TWILIO_FROM_NUMBER),
      mapboxConfigured: Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN),
      notificationsCronConfigured: Boolean(process.env.NOTIFICATIONS_CRON_SECRET),
    },
  })
}
