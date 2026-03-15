"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type UserRole = "survivor" | "courier" | "admin" | null

function roleToDestination(role: UserRole) {
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

export default function AccessDeniedPage() {
  const router = useRouter()
  const [from, setFrom] = useState("restricted area")
  const [required, setRequired] = useState("authorized role")
  const [role, setRole] = useState<UserRole>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setFrom(params.get("from") || "restricted area")
    setRequired(params.get("required") || "authorized role")

    let mounted = true

    const loadRole = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!mounted || !user) {
        setRole(null)
        return
      }

      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      if (!mounted) {
        return
      }

      setRole((data?.role ?? null) as UserRole)
    }

    loadRole()

    return () => {
      mounted = false
    }
  }, [])

  const destination = useMemo(() => roleToDestination(role), [role])
  const label = useMemo(() => {
    if (role === "survivor") {
      return "Go to Request Dashboard"
    }

    if (role === "courier") {
      return "Go to Courier Dashboard"
    }

    if (role === "admin") {
      return "Go to Admin Dashboard"
    }

    return "Go Home"
  }, [role])

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <div className="bg-white shadow-md rounded-xl p-6 space-y-4">
        <h1 className="text-3xl font-bold text-red-700">Access Denied</h1>
        <p className="text-gray-700">
          You do not have permission to access <strong>{from}</strong>.
        </p>
        <p className="text-gray-700">
          Required role: <strong className="capitalize">{required}</strong>
        </p>
        <p className="text-sm text-gray-600">
          If this is unexpected, ask an administrator to update your account role.
        </p>

        <div className="pt-2 flex flex-wrap gap-3">
          <Link href={destination} className="inline-block bg-blue-900 text-white px-4 py-2 rounded">
            {label}
          </Link>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-block bg-gray-200 text-gray-900 px-4 py-2 rounded"
          >
            Back to Previous Page
          </button>
        </div>
      </div>
    </div>
  )
}
