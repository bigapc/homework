import { NextResponse } from "next/server"
import { getServerAdminSupabase } from "@/lib/serverAdminSupabase"

export const runtime = "nodejs"

type NotificationEventRow = {
  id: string
  channel: "sms" | "email"
  recipient: string
  template: string
  payload: Record<string, unknown>
  attempts: number
}

async function sendSms({ to, body }: { to: string; body: string }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !from) {
    throw new Error("Twilio credentials are not configured.")
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64")
  const params = new URLSearchParams({
    To: to,
    From: from,
    Body: body,
  })

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Twilio send failed: ${text}`)
  }

  const data = (await response.json()) as { sid?: string }
  return data.sid || null
}

function renderTemplate(row: NotificationEventRow) {
  if (row.template === "courier_assignment") {
    const pickup = String(row.payload?.pickup || "pickup location")
    const dropoff = String(row.payload?.dropoff || "dropoff location")
    return `SafeConnect: New assignment is ready. Pickup: ${pickup}. Dropoff: ${dropoff}.`
  }

  if (row.template === "payment_received") {
    const cents = Number(row.payload?.amount || 0)
    const amount = Number.isFinite(cents) ? (cents / 100).toFixed(2) : "0.00"
    return `SafeConnect: Payment received ($${amount}). Thank you.`
  }

  return "SafeConnect notification update."
}

export async function POST(request: Request) {
  const cronSecret = process.env.NOTIFICATIONS_CRON_SECRET

  if (cronSecret) {
    const authHeader = request.headers.get("authorization") || ""
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const supabase = getServerAdminSupabase()

  if (!supabase) {
    return NextResponse.json({ error: "Server admin client not configured." }, { status: 503 })
  }

  const { data, error } = await supabase
    .from("notification_events")
    .select("id,channel,recipient,template,payload,attempts")
    .in("status", ["queued", "failed"])
    .is("dead_lettered_at", null)
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(25)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as NotificationEventRow[]
  let sent = 0
  let failed = 0
  let deadLettered = 0
  const maxAttempts = 5

  for (const row of rows) {
    try {
      if (row.channel === "sms") {
        const sid = await sendSms({
          to: row.recipient,
          body: renderTemplate(row),
        })

        await supabase
          .from("notification_events")
          .update({
            status: "sent",
            provider_message_id: sid,
            sent_at: new Date().toISOString(),
            error_message: null,
            attempts: row.attempts + 1,
          })
          .eq("id", row.id)
      } else {
        throw new Error("Unsupported channel")
      }
      sent += 1
    } catch (sendError) {
      failed += 1
      const nextAttempts = row.attempts + 1
      const shouldDeadLetter = nextAttempts >= maxAttempts
      const retryAfterMs = Math.min(30 * 60 * 1000, Math.pow(2, Math.max(0, nextAttempts - 1)) * 60 * 1000)

      await supabase
        .from("notification_events")
        .update({
          status: shouldDeadLetter ? "failed" : "queued",
          error_message: sendError instanceof Error ? sendError.message : "Unknown send error",
          attempts: nextAttempts,
          next_attempt_at: shouldDeadLetter ? new Date().toISOString() : new Date(Date.now() + retryAfterMs).toISOString(),
          dead_lettered_at: shouldDeadLetter ? new Date().toISOString() : null,
        })
        .eq("id", row.id)

      if (shouldDeadLetter) {
        deadLettered += 1
      }
    }
  }

  return NextResponse.json({ queued: rows.length, sent, failed, deadLettered })
}
