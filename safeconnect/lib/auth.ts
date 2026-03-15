import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

export type UserRole = "survivor" | "courier" | "admin" | null

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
  const resolvedUserId = userId ?? (await getCurrentUser())?.id

  if (!resolvedUserId) {
    return null
  }

  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", resolvedUserId)
    .single()

  if (error) {
    return null
  }

  return (data?.role ?? null) as UserRole
}

export async function getCurrentUserWithRole() {
  const user = await getCurrentUser()

  if (!user) {
    return { user: null, role: null as UserRole }
  }

  const role = await getCurrentUserRole(user.id)
  return { user, role }
}
