import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

export type UserRole = "survivor" | "courier" | "admin" | null

type SessionPayload = {
  user: { id: string; email: string | null } | null
  role: UserRole
}

export function getDashboardPathForRole(role: UserRole) {
  if (role === "survivor") {
    return "/request"
  }

  if (role === "courier") {
    return "/courier"
  }

  if (role === "admin") {
    return "/admin"
  }

  return "/"
}

export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    return null
  }

  return user
}

export async function getCurrentUserRole(userId?: string): Promise<UserRole> {
  const { user, role } = await getCurrentUserWithRole()

  if (!user) {
    return null
  }

  if (userId && user.id !== userId) {
    return null
  }

  return role
}

export async function getCurrentUserWithRole() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { user: null, role: null as UserRole }
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const headers: Record<string, string> = {}
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`
    }

    const response = await fetch("/api/auth/session", {
      method: "GET",
      cache: "no-store",
      headers,
    })

    if (response.ok) {
      const payload = (await response.json()) as SessionPayload

      if (payload.user?.id === user.id) {
        return { user, role: payload.role ?? null }
      }
    }
  } catch {
    // Fall back to auth-only state when role lookup fails.
  }

  return { user, role: null as UserRole }
}
