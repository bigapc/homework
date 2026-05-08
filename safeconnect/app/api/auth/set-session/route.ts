import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

type SetSessionBody = {
  accessToken?: string
  refreshToken?: string
}

export const runtime = "nodejs"

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase client unavailable." }, { status: 503 })
  }

  const body = (await request.json().catch(() => ({}))) as SetSessionBody
  const accessToken = body.accessToken?.trim()
  const refreshToken = body.refreshToken?.trim()

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "Missing accessToken or refreshToken." }, { status: 400 })
  }

  const cookieStore = await cookies()
  const response = NextResponse.json({ success: true })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  return response
}