"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type UserRole = "survivor" | "courier" | "admin" | null

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<UserRole>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return

      if (!user) {
        setEmail("")
        setRole(null)
        setLoading(false)
        return
      }

      setEmail(user.email ?? "")

      const { data: userRow } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      if (!mounted) return
      setRole((userRow?.role ?? null) as UserRole)
      setLoading(false)
    }

    loadSession()
    return () => { mounted = false }
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setEmail("")
    setRole(null)
    router.push("/login")
    router.refresh()
  }

  const isActive = (href: string) => pathname === href

  const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <Link
      href={href}
      className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-all duration-150 ${
        isActive(href)
          ? "bg-safe-700 text-white"
          : "text-safe-100 hover:text-white hover:bg-safe-700/60"
      }`}
    >
      {children}
    </Link>
  )

  return (
    <nav className="sticky top-0 z-50 bg-safe-900 border-b border-safe-800 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-warm-400 text-safe-900 font-black text-sm shadow-sm group-hover:bg-warm-300 transition-colors">
              SC
            </span>
            <span className="font-bold text-white text-lg tracking-tight">
              Safe<span className="text-warm-400">Connect</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-1">
            <NavLink href="/">Home</NavLink>

            {!loading && role === "survivor" && <NavLink href="/request">Request Courier</NavLink>}
            {!loading && role === "survivor" && <NavLink href="/safety-plan">Safety Plan</NavLink>}
            {!loading && role === "survivor" && <NavLink href="/incident-log">Incident Log</NavLink>}
            {!loading && role === "survivor" && <NavLink href="/legal-docs">Legal Docs</NavLink>}
            {!loading && role === "survivor" && <NavLink href="/payments">Payments</NavLink>}
            {!loading && role === "courier"  && <NavLink href="/courier">Courier Portal</NavLink>}
            {!loading && role === "admin"    && <NavLink href="/admin">Admin</NavLink>}
            {!loading && role === "admin"    && <NavLink href="/admin/dispatch">Dispatch</NavLink>}
            {!loading && role === "admin"    && <NavLink href="/admin/review">Review</NavLink>}
            {!loading && role === "admin"    && <NavLink href="/admin/encryption">Encryption</NavLink>}

            <div className="ml-4 flex items-center gap-2">
              {!loading && !email ? (
                <>
                  <Link href="/login"  className="text-sm font-medium text-safe-100 hover:text-white px-3 py-1.5 transition-colors">Sign In</Link>
                  <Link href="/signup" className="text-sm font-semibold bg-warm-400 hover:bg-warm-300 text-safe-900 px-4 py-1.5 rounded-lg transition-colors shadow-sm">Get Started</Link>
                </>
              ) : !loading && email ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-safe-300 hidden md:block truncate max-w-[160px]">{email}</span>
                  <button
                    onClick={handleSignOut}
                    className="text-sm font-medium bg-safe-800 hover:bg-safe-700 text-white px-4 py-1.5 rounded-lg border border-safe-700 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="sm:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-safe-800 transition-colors"
            aria-label="Toggle menu"
          >
            <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-safe-800 bg-safe-900 px-4 pb-4 pt-3 flex flex-col gap-1 animate-fade-in">
          <NavLink href="/">Home</NavLink>
          {!loading && role === "survivor" && <NavLink href="/request">Request Courier</NavLink>}
          {!loading && role === "survivor" && <NavLink href="/safety-plan">Safety Plan</NavLink>}
          {!loading && role === "survivor" && <NavLink href="/incident-log">Incident Log</NavLink>}
          {!loading && role === "survivor" && <NavLink href="/legal-docs">Legal Docs</NavLink>}
          {!loading && role === "survivor" && <NavLink href="/payments">Payments</NavLink>}
          {!loading && role === "courier"  && <NavLink href="/courier">Courier Portal</NavLink>}
          {!loading && role === "admin"    && <NavLink href="/admin">Admin</NavLink>}
          {!loading && role === "admin"    && <NavLink href="/admin/dispatch">Dispatch</NavLink>}
          {!loading && role === "admin"    && <NavLink href="/admin/review">Review</NavLink>}
          {!loading && role === "admin"    && <NavLink href="/admin/encryption">Encryption</NavLink>}

          <div className="mt-3 pt-3 border-t border-safe-800">
            {!loading && !email ? (
              <div className="flex gap-2">
                <Link href="/login"  className="flex-1 text-center text-sm font-medium text-safe-100 hover:text-white border border-safe-700 px-3 py-2 rounded-lg transition-colors">Sign In</Link>
                <Link href="/signup" className="flex-1 text-center text-sm font-semibold bg-warm-400 hover:bg-warm-300 text-safe-900 px-3 py-2 rounded-lg transition-colors">Get Started</Link>
              </div>
            ) : !loading && email ? (
              <div className="space-y-2">
                <p className="text-xs text-safe-400 truncate">{email}</p>
                <button
                  onClick={handleSignOut}
                  className="w-full text-sm font-medium bg-safe-800 hover:bg-safe-700 text-white px-4 py-2 rounded-lg border border-safe-700 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </nav>
  )
}

