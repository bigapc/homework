import { createClient } from "@supabase/supabase-js"

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  return createClient(url || "https://placeholder.supabase.co", key || "placeholder")
}

export const supabase = getSupabaseClient()
