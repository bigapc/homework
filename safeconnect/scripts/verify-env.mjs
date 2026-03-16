#!/usr/bin/env node

import fs from "fs"
import path from "path"

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const workspaceRoot = path.resolve(projectRoot, "..")

const envFiles = [
  path.join(workspaceRoot, ".env"),
  path.join(workspaceRoot, ".env.local"),
  path.join(projectRoot, ".env"),
  path.join(projectRoot, ".env.local"),
]
const projectEnvLocalPath = path.join(projectRoot, ".env.local")

const requiredLocal = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]

const optionalLocal = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "NEXT_PUBLIC_MAPBOX_TOKEN",
  "NOTIFICATIONS_CRON_SECRET",
  "NEXT_PUBLIC_APP_URL",
]

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {}
  }

  const content = fs.readFileSync(filePath, "utf8")
  const rows = content.split(/\r?\n/)
  const env = {}

  for (const row of rows) {
    const line = row.trim()
    if (!line || line.startsWith("#")) continue

    const idx = line.indexOf("=")
    if (idx <= 0) continue

    const key = line.slice(0, idx).trim()
    const raw = line.slice(idx + 1).trim()
    const value = raw.replace(/^['\"]/, "").replace(/['\"]$/, "")
    env[key] = value
  }

  return env
}

function hasValue(value) {
  return typeof value === "string" && value.trim().length > 0
}

function verifyLocalEnv() {
  const dotEnvValues = {}
  const foundFiles = []
  const sourceMaps = {}

  for (const filePath of envFiles) {
    if (!fs.existsSync(filePath)) {
      continue
    }

    const parsed = parseDotEnv(filePath)
    sourceMaps[filePath] = parsed
    Object.assign(dotEnvValues, parsed)
    foundFiles.push(path.relative(projectRoot, filePath) || ".")
  }

  const merged = { ...dotEnvValues, ...process.env }

  const missingRequired = requiredLocal.filter((key) => !hasValue(merged[key]))
  const missingOptional = optionalLocal.filter((key) => !hasValue(merged[key]))
  const projectEnvLocal = sourceMaps[projectEnvLocalPath] || {}
  const blankOverrides = [...requiredLocal, ...optionalLocal].filter(
    (key) => Object.prototype.hasOwnProperty.call(projectEnvLocal, key) && !hasValue(projectEnvLocal[key])
  )

  console.log("Local environment check")
  if (foundFiles.length > 0) {
    console.log(`- Loaded env files: ${foundFiles.join(", ")}`)
  } else {
    console.log("- Loaded env files: none")
  }

  if (missingRequired.length > 0) {
    console.error(`- Missing required vars: ${missingRequired.join(", ")}`)
  } else {
    console.log("- Required vars: configured")
  }

  if (missingOptional.length > 0) {
    console.log(`- Optional vars not set: ${missingOptional.join(", ")}`)
  } else {
    console.log("- Optional vars: configured")
  }

  if (blankOverrides.length > 0) {
    console.log(
      `- Empty overrides in .env.local (these shadow other files): ${blankOverrides.join(", ")}`
    )
  }

  return { missingRequired }
}

async function verifyProdHealth(baseUrl) {
  const normalized = baseUrl.replace(/\/$/, "")
  const healthUrl = `${normalized}/api/health`
  console.log(`Production health check: ${healthUrl}`)

  const response = await fetch(healthUrl)
  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`)
  }

  const payload = await response.json()
  const env = payload?.env || {}

  console.log(`- status: ${payload?.status || "unknown"}`)
  console.log(`- supabasePublicConfigured: ${Boolean(env.supabasePublicConfigured)}`)
  console.log(`- serviceRoleConfigured: ${Boolean(env.serviceRoleConfigured)}`)
  console.log(`- stripeConfigured: ${Boolean(env.stripeConfigured)}`)
  console.log(`- stripeWebhookConfigured: ${Boolean(env.stripeWebhookConfigured)}`)
  console.log(`- twilioConfigured: ${Boolean(env.twilioConfigured)}`)
  console.log(`- mapboxConfigured: ${Boolean(env.mapboxConfigured)}`)
  console.log(`- notificationsCronConfigured: ${Boolean(env.notificationsCronConfigured)}`)

  if (Array.isArray(env.missingStartupEnv) && env.missingStartupEnv.length > 0) {
    console.error(`- Missing startup env (from server): ${env.missingStartupEnv.join(", ")}`)
    return false
  }

  return true
}

async function main() {
  const { missingRequired } = verifyLocalEnv()

  let prodOk = true
  if (process.env.PROD_URL) {
    try {
      prodOk = await verifyProdHealth(process.env.PROD_URL)
    } catch (error) {
      console.error(`- Production check failed: ${error instanceof Error ? error.message : String(error)}`)
      prodOk = false
    }
  } else {
    console.log("Production check skipped (set PROD_URL to enable)")
  }

  if (missingRequired.length > 0 || !prodOk) {
    process.exit(1)
  }

  console.log("Environment verification passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
