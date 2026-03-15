import { NextResponse } from "next/server"
import Stripe from "stripe"
import { getServerAdminSupabase } from "@/lib/serverAdminSupabase"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!stripeSecret || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 })
  }

  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe signature." }, { status: 400 })
  }

  const stripe = new Stripe(stripeSecret)
  const payload = await request.text()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature"
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const exchangeId = session.metadata?.exchange_id

    if (exchangeId) {
      const supabase = getServerAdminSupabase()

      if (supabase) {
        const { data: exchange } = await supabase
          .from("exchanges")
          .select("id,user_id")
          .eq("id", exchangeId)
          .single()

        if (exchange?.user_id) {
          const { data: pendingRows } = await supabase
            .from("exchange_payments")
            .select("id")
            .eq("exchange_id", exchange.id)
            .eq("user_id", exchange.user_id)
            .eq("status", "pending")
            .is("stripe_checkout_session_id", null)
            .order("created_at", { ascending: false })
            .limit(1)

          if (pendingRows && pendingRows.length > 0) {
            await supabase
              .from("exchange_payments")
              .update({
                amount_cents: session.amount_total || 0,
                currency: session.currency || "usd",
                stripe_checkout_session_id: session.id,
                stripe_payment_intent_id:
                  typeof session.payment_intent === "string" ? session.payment_intent : null,
                status: "paid",
                updated_at: new Date().toISOString(),
              })
              .eq("id", pendingRows[0].id)
          } else {
            await supabase.from("exchange_payments").insert({
              exchange_id: exchange.id,
              user_id: exchange.user_id,
              amount_cents: session.amount_total || 0,
              currency: session.currency || "usd",
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id:
                typeof session.payment_intent === "string" ? session.payment_intent : null,
              status: "paid",
            })
          }

          await supabase.from("notification_events").insert({
            user_id: exchange.user_id,
            exchange_id: exchange.id,
            channel: "sms",
            recipient: session.customer_details?.phone || "pending-user-number",
            template: "payment_received",
            payload: {
              exchangeId: exchange.id,
              amount: session.amount_total || 0,
              currency: session.currency || "usd",
            },
          })
        }
      }
    }
  }

  return NextResponse.json({ received: true })
}
