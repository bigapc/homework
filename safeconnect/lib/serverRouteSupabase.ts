import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export function getServerRouteSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return null
  }

  const cookieStore = cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll() {
        // Read-only for route handlers in this app.
      },
    },
  })
}
