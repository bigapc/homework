"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUserWithRole, type UserRole } from "@/lib/auth"

type AllowedRole = Exclude<UserRole, null>

type ProtectedRouteProps = {
  children: React.ReactNode
  requiredRole?: AllowedRole
  requiredRoles?: AllowedRole[]
  loadingLabel?: string
}

export default function ProtectedRoute({
  children,
  requiredRole,
  requiredRoles,
  loadingLabel = "Checking access…",
}: ProtectedRouteProps) {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const allowedRoles = useMemo(() => {
    if (requiredRoles?.length) return requiredRoles
    return requiredRole ? [requiredRole] : []
  }, [requiredRole, requiredRoles])

  useEffect(() => {
    let mounted = true

    const checkAccess = async () => {
      const { user, role } = await getCurrentUserWithRole()

      if (!mounted) {
        return
      }

      if (!user) {
        router.replace("/login")
        return
      }

      if (allowedRoles.length > 0 && (!role || !allowedRoles.includes(role))) {
        const params = new URLSearchParams({
          from: window.location.pathname,
          required: allowedRoles.join(","),
        })
        router.replace(`/access-denied?${params.toString()}`)
        return
      }

      setReady(true)
    }

    checkAccess()

    return () => {
      mounted = false
    }
  }, [allowedRoles, router])

  if (!ready) {
    return (
      <div className="page-container">
        <div className="card py-10 text-center text-safe-500">{loadingLabel}</div>
      </div>
    )
  }

  return <>{children}</>
}
