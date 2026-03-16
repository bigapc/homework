import { NextResponse } from "next/server"
import Stripe from "stripe"
import { getServerRouteSupabase } from "@/lib/serverRouteSupabase"
import { getMissingRequiredEnv } from "@/lib/env"

export const runtime = "nodejs"

type CreateCheckoutBody = {
  exchangeId?: string
  amountCents?: number
}

export async function POST(request: Request) {
  const missingStripeEnv = getMissingRequiredEnv("stripe-checkout")
  if (missingStripeEnv.length > 0) {
    return NextResponse.json(
      {
        error: `Stripe checkout is not configured. Missing env vars: ${missingStripeEnv.join(", ")}`,
      },
      { status: 503 }
    )
  }

  const supabase = getServerRouteSupabase()

  if (!supabase) {
    return NextResponse.json({ error: "Supabase route client unavailable." }, { status: 503 })
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY as string

  const body = (await request.json().catch(() => ({}))) as CreateCheckoutBody
  const exchangeId = body.exchangeId
  const amountCents = Math.round(Number(body.amountCents ?? 0))
  const idempotencyKey = request.headers.get("x-idempotency-key") || crypto.randomUUID()

  if (!exchangeId || amountCents <= 0) {
    return NextResponse.json({ error: "Invalid checkout payload." }, { status: 400 })
  }

  const { data: exchange, error: exchangeError } = await supabase
    .from("exchanges")
    .select("id,user_id")
    .eq("id", exchangeId)
    .eq("user_id", user.id)
    .single()

  if (exchangeError || !exchange) {
    return NextResponse.json({ error: "Exchange not found for current user." }, { status: 404 })
  }

  const { data: existingRow } = await supabase
    .from("exchange_payments")
    .select("id,checkout_url,status")
    .eq("user_id", user.id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()

  if (existingRow?.checkout_url && existingRow.status !== "paid") {
    return NextResponse.json({ url: existingRow.checkout_url, reused: true })
  }

  const stripe = new Stripe(stripeSecret)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            product_data: {
              name: "SafeConnect Exchange Service",
              description: `Exchange ${exchangeId.slice(0, 8).toUpperCase()}`,
            },
            unit_amount: amountCents,
          },
        },
      ],
      success_url: `${appUrl}/payments?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/payments?status=cancelled`,
      metadata: {
        exchange_id: exchangeId,
      },
    },
    {
      idempotencyKey,
    }
  )

  if (existingRow?.id) {
    await supabase
      .from("exchange_payments")
      .update({
        amount_cents: amountCents,
        currency: "usd",
        status: "pending",
        stripe_checkout_session_id: session.id,
        checkout_url: session.url,
      })
      .eq("id", existingRow.id)
  } else {
    await supabase.from("exchange_payments").insert({
      exchange_id: exchange.id,
      user_id: user.id,
      amount_cents: amountCents,
      currency: "usd",
      status: "pending",
      stripe_checkout_session_id: session.id,
      checkout_url: session.url,
      idempotency_key: idempotencyKey,
    })
  }

  await supabase.from("compliance_audit_logs").insert({
    actor_user_id: user.id,
    actor_role: "survivor",
    action: "payment_checkout_created",
    resource_type: "exchange_payment",
    resource_id: exchange.id,
    metadata: {
      amountCents,
      idempotencyKey,
      sessionId: session.id,
    },
  })

  return NextResponse.json({
    id: session.id,
    url: session.url,
    idempotencyKey,
  })
}
