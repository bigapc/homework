#!/usr/bin/env node

import path from "path"
import { fileURLToPath } from "url"
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, "..")

// Load environment variables
config({ path: path.join(projectRoot, ".env.local") })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function grantAdmin(email) {
  try {
    console.log(`🔄 Granting admin access to: ${email}`)

    // Check if user exists
    const { data: user, error: getUserError } = await supabase
      .from("users")
      .select("id, role")
      .eq("email", email)
      .single()

    if (getUserError || !user) {
      console.error(`❌ User not found: ${email}`)
      console.error("   Make sure the user has signed up first!")
      process.exit(1)
    }

    console.log(`   Current role: ${user.role}`)

    // Update role to admin
    const { error: updateError } = await supabase
      .from("users")
      .update({ role: "admin" })
      .eq("id", user.id)

    if (updateError) {
      console.error(`❌ Error updating role:`, updateError.message)
      process.exit(1)
    }

    console.log(`✅ Successfully granted admin access!`)
    console.log(`   Email: ${email}`)
    console.log(`   New role: admin`)
    console.log(`\n📝 Next steps:`)
    console.log(`   1. Sign in with ${email}`)
    console.log(`   2. Navigate to the /admin page`)
    console.log(`   3. You should now have full admin access`)
  } catch (err) {
    console.error("❌ Unexpected error:", err.message)
    process.exit(1)
  }
}

const email = process.argv[2]

if (!email) {
  console.error("❌ Usage: node scripts/grant-admin.mjs <email>")
  console.error("   Example: node scripts/grant-admin.mjs bizz16295@gmail.com")
  process.exit(1)
}

grantAdmin(email)
