"use client"

export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getCurrentUserWithRole, getDashboardPathForRole } from "@/lib/auth"
import { syncSessionToServerCookies } from "@/lib/sessionSync"

function getEmailRedirectTo() {
  if (typeof window === "undefined") {
    return undefined
  }

  return `${window.location.origin}/login`
}

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getEmailRedirectTo(),
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.session) {
      await syncSessionToServerCookies(data.session)
      const { role } = await getCurrentUserWithRole()
      router.replace(getDashboardPathForRole(role))
      return
    }

    setSuccess("Account created. Check your email to confirm your account, then sign in.")
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <h1 className="text-3xl font-bold mb-6 text-blue-900">Create Account</h1>

      <form onSubmit={handleSignup} className="bg-white shadow-md rounded-xl p-6 space-y-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && <p className="text-emerald-700 text-sm">{success}</p>}

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
          placeholder="Password (min 6 characters)"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-900 text-white px-4 py-2 rounded w-full disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Sign Up"}
        </button>

        <p className="text-sm text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-700 underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
