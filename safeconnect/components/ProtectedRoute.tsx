"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUserWithRole, type UserRole } from "@/lib/auth"

type ProtectedRouteProps = {
  children: React.ReactNode
  requiredRole?: Exclude<UserRole, null>
  loadingLabel?: string
}

export default function ProtectedRoute({
  children,
  requiredRole,
  loadingLabel = "Checking access…",
}: ProtectedRouteProps) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

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

      if (requiredRole && role !== requiredRole) {
        const params = new URLSearchParams({
          from: window.location.pathname,
          required: requiredRole,
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
  }, [requiredRole, router])

  if (!ready) {
    return (
      <div className="page-container">
        <div className="card py-10 text-center text-safe-500">{loadingLabel}</div>
      </div>
    )
  }

  return <>{children}</>
}
