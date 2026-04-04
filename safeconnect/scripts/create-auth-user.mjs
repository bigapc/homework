#!/usr/bin/env node

import path from "path"
import { fileURLToPath } from "url"
import { config } from "dotenv"
import { createClient } from "@supabase/supabase-js"
import { promisify } from "util"
import { stdin as input, stdout as output } from "process"
import readline from "readline"

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

const rl = readline.createInterface({ input, output })
const question = promisify(rl.question).bind(rl)

async function createAuthUser(email, password) {
  try {
    console.log(`🔄 Creating auth account for: ${email}`)

    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm the email
    })

    if (error) {
      console.error(`❌ Error creating auth user:`, error.message)
      process.exit(1)
    }

    console.log(`✅ Auth account created successfully!`)
    console.log(`   Email: ${email}`)
    console.log(`   Status: Email confirmed`)
    console.log(`\n📝 Next steps:`)
    console.log(`   1. Go to https://safeconnect-roan.vercel.app`)
    console.log(`   2. Click "Sign In"`)
    console.log(`   3. Enter your email and password`)
    console.log(`   4. You should now be logged in with admin access`)
    console.log(`   5. Navigate to /admin to see the admin dashboard`)
  } catch (err) {
    console.error("❌ Unexpected error:", err.message)
    process.exit(1)
  } finally {
    rl.close()
  }
}

const email = process.argv[2]

if (!email) {
  console.error("❌ Usage: node scripts/create-auth-user.mjs <email> [password]")
  console.error("   Example: node scripts/create-auth-user.mjs bizz16295@gmail.com mypassword123")
  process.exit(1)
}

let password = process.argv[3]

if (!password) {
  console.log(`Creating auth account for: ${email}`)
  question("\nEnter password: ", async (pass) => {
    if (!pass) {
      console.error("❌ Password is required")
      rl.close()
      process.exit(1)
    }
    await createAuthUser(email, pass)
  })
} else {
  createAuthUser(email, password)
}
