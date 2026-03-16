import "server-only"
import { createHash } from "crypto"

type EnvScope = "startup" | "health" | "stripe-checkout" | "stripe-webhook"

type EnvSpec = {
  key: string
  requiredIn: EnvScope[]
  secret: boolean
}

const ENV_SPECS: EnvSpec[] = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", requiredIn: ["startup", "health"], secret: false },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", requiredIn: ["startup", "health"], secret: false },
  { key: "SUPABASE_SERVICE_ROLE_KEY", requiredIn: ["health"], secret: true },
  { key: "STRIPE_SECRET_KEY", requiredIn: ["stripe-checkout", "stripe-webhook", "health"], secret: true },
  { key: "STRIPE_WEBHOOK_SECRET", requiredIn: ["stripe-webhook", "health"], secret: true },
  { key: "TWILIO_ACCOUNT_SID", requiredIn: ["health"], secret: true },
  { key: "TWILIO_AUTH_TOKEN", requiredIn: ["health"], secret: true },
  { key: "TWILIO_FROM_NUMBER", requiredIn: ["health"], secret: false },
  { key: "NEXT_PUBLIC_MAPBOX_TOKEN", requiredIn: ["health"], secret: false },
  { key: "NOTIFICATIONS_CRON_SECRET", requiredIn: ["health"], secret: true },
]

function readEnv(key: string): string {
  return process.env[key]?.trim() ?? ""
}

function isConfigured(key: string): boolean {
  return readEnv(key).length > 0
}

export function getMissingRequiredEnv(scope: EnvScope): string[] {
  return ENV_SPECS.filter((spec) => spec.requiredIn.includes(scope))
    .map((spec) => spec.key)
    .filter((key) => !isConfigured(key))
}

export function assertRequiredEnv(scope: EnvScope, contextLabel: string): void {
  const missing = getMissingRequiredEnv(scope)
  if (missing.length === 0) {
    return
  }

  throw new Error(
    `[env] Missing required env vars for ${contextLabel}: ${missing.join(", ")}. Set these in Vercel Project Settings -> Environment Variables and local .env.local.`
  )
}

function makeFingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12)
}

export function getHealthEnvSummary() {
  const details = Object.fromEntries(
    ENV_SPECS.map((spec) => {
      const value = readEnv(spec.key)
      return [
        spec.key,
        {
          configured: value.length > 0,
          secret: spec.secret,
          length: value.length,
          fingerprint: value ? makeFingerprint(value) : null,
        },
      ]
    })
  )

  return {
    supabasePublicConfigured:
      details.NEXT_PUBLIC_SUPABASE_URL.configured && details.NEXT_PUBLIC_SUPABASE_ANON_KEY.configured,
    serviceRoleConfigured: details.SUPABASE_SERVICE_ROLE_KEY.configured,
    stripeConfigured: details.STRIPE_SECRET_KEY.configured,
    stripeWebhookConfigured: details.STRIPE_WEBHOOK_SECRET.configured,
    twilioConfigured:
      details.TWILIO_ACCOUNT_SID.configured &&
      details.TWILIO_AUTH_TOKEN.configured &&
      details.TWILIO_FROM_NUMBER.configured,
    mapboxConfigured: details.NEXT_PUBLIC_MAPBOX_TOKEN.configured,
    notificationsCronConfigured: details.NOTIFICATIONS_CRON_SECRET.configured,
    missingStartupEnv: getMissingRequiredEnv("startup"),
    details,
  }
}
