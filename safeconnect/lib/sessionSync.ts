import type { Session } from "@supabase/supabase-js"

export async function syncSessionToServerCookies(session: Session | null) {
  if (!session?.access_token || !session?.refresh_token) {
    return
  }

  await fetch("/api/auth/set-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    }),
    cache: "no-store",
  })
}