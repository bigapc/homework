"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUserWithRole, getDashboardPathForRole } from "@/lib/auth"

export default function DashboardPage() {
  const router = useRouter()
  const [message, setMessage] = useState("Loading your dashboard…")

  useEffect(() => {
    let mounted = true

    const routeUser = async () => {
      const { user, role } = await getCurrentUserWithRole()

      if (!mounted) {
        return
      }

      if (!user) {
        router.replace("/login")
        return
      }

      const destination = getDashboardPathForRole(role)
      setMessage(`Redirecting to ${destination}…`)
      router.replace(destination)
    }

    routeUser()

    return () => {
      mounted = false
    }
  }, [router])

  return (
    <div className="page-container">
      <div className="card py-10 text-center space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Dashboard</p>
        <h1 className="text-2xl font-bold text-safe-900">Secure Redirect</h1>
        <p className="text-safe-500">{message}</p>
      </div>
    </div>
  )
}
