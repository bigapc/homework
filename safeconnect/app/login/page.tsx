"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getCurrentUserWithRole, getDashboardPathForRole } from "@/lib/auth"
import { syncSessionToServerCookies } from "@/lib/sessionSync"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    const redirectIfSignedIn = async () => {
      const { user, role } = await getCurrentUserWithRole()

      if (!mounted || !user) {
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()
      await syncSessionToServerCookies(session)

      router.replace(getDashboardPathForRole(role))
    }

    redirectIfSignedIn()

    return () => {
      mounted = false
    }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      await syncSessionToServerCookies(data.session)
      const { role } = await getCurrentUserWithRole()
      router.replace(getDashboardPathForRole(role))
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <h1 className="text-3xl font-bold mb-6 text-blue-900">Sign In</h1>

      <form onSubmit={handleLogin} className="bg-white shadow-md rounded-xl p-6 space-y-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}

        <input
          type="email"
          className="w-full border p-2 rounded"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          className="w-full border p-2 rounded"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-900 text-white px-4 py-2 rounded w-full disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <p className="text-sm text-center">
          No account?{" "}
          <Link href="/signup" className="text-blue-700 underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  )
}
