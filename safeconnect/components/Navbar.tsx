"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BookOpen,
  Building2,
  CalendarDays,
  Calculator,
  HeartHandshake,
  Home,
  Menu,
  Phone,
  Scale,
  Shield,
  Truck,
  UserPlus,
  X,
  FileText,
  CreditCard,
  Settings,
  ClipboardList,
  KeyRound,
} from "lucide-react"
import { supabase } from "@/lib/supabase"

type UserRole = "survivor" | "courier" | "admin" | null

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: UserRole[]
}

const mainServices: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/request", label: "Courier Services", icon: Truck },
  { href: "/safety-plan", label: "Safety Planning", icon: Shield, roles: ["survivor"] },
  { href: "/legal-aid", label: "Legal Aid", icon: Scale },
  { href: "/schedule", label: "Consultations", icon: CalendarDays },
  { href: "/directory", label: "Government Resources", icon: Building2 },
]

const toolLinks: NavItem[] = [
  { href: "/request", label: "Pricing Calculator", icon: Calculator },
  { href: "/courier", label: "Courier Dashboard", icon: Truck, roles: ["courier"] },
  { href: "/courier/onboard", label: "Courier Onboarding", icon: UserPlus },
  { href: "/incident-log", label: "Incident Log", icon: ClipboardList, roles: ["survivor"] },
  { href: "/legal-docs", label: "Secure Files", icon: FileText, roles: ["survivor"] },
  { href: "/payments", label: "Invoices & Payments", icon: CreditCard, roles: ["survivor"] },
]

const adminLinks: NavItem[] = [
  { href: "/admin", label: "Admin", icon: Settings, roles: ["admin"] },
  { href: "/admin/dispatch", label: "Dispatch", icon: Truck, roles: ["admin"] },
  { href: "/admin/review", label: "Review", icon: ClipboardList, roles: ["admin"] },
  { href: "/admin/encryption", label: "Encryption", icon: KeyRound, roles: ["admin"] },
]

function hasAccess(role: UserRole, item: NavItem) {
  if (!item.roles || item.roles.length === 0) {
    return true
  }
  return item.roles.includes(role)
}

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
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!mounted) {
        return
      }

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

      if (!mounted) {
        return
      }

      setRole((userRow?.role ?? null) as UserRole)
      setLoading(false)
    }

    loadSession()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setEmail("")
    setRole(null)
    router.push("/login")
    router.refresh()
  }

  const visibleMain = mainServices.filter((item) => hasAccess(role, item))
  const visibleTools = toolLinks.filter((item) => hasAccess(role, item))
  const visibleAdmin = adminLinks.filter((item) => hasAccess(role, item))

  const linkClass = (href: string, tone: "main" | "tool" = "main") => {
    const active = pathname === href
    if (tone === "tool") {
      return active
        ? "bg-white text-safe-900 border border-warm-300 shadow-sm"
        : "text-safe-100/90 hover:text-white hover:bg-white/10 border border-transparent"
    }

    return active
      ? "bg-warm-400 text-safe-950 shadow-sm"
      : "text-white/90 hover:text-white hover:bg-white/10"
  }

  const NavChip = ({ item, tone = "main" }: { item: NavItem; tone?: "main" | "tool" }) => {
    const Icon = item.icon

    return (
      <Link
        href={item.href}
        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${linkClass(item.href, tone)}`}
      >
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
      </Link>
    )
  }

  const MobileLink = ({ item }: { item: NavItem }) => {
    const Icon = item.icon
    const active = pathname === item.href

    return (
      <Link
        href={item.href}
        className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-colors ${
          active ? "bg-safe-50 text-safe-900 border border-safe-200" : "text-safe-700 hover:bg-safe-50"
        }`}
      >
        <Icon className={`h-4 w-4 ${active ? "text-safe-700" : "text-safe-500"}`} />
        <span className="font-medium">{item.label}</span>
      </Link>
    )
  }

  return (
    <header className="sticky top-0 z-50 border-b border-safe-200/80 bg-white/90 backdrop-blur-xl shadow-sm">
      <div className="bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 text-xs font-medium sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <a href="tel:911" className="inline-flex items-center gap-2 hover:text-red-100">
              <Phone className="h-3.5 w-3.5" />
              <span>Emergency: 911</span>
            </a>
            <a href="tel:18007997233" className="inline-flex items-center gap-2 hover:text-red-100">
              <HeartHandshake className="h-3.5 w-3.5" />
              <span>National DV Hotline: 1-800-799-7233</span>
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-red-50/95">
            <a href="tel:+13074540044" className="inline-flex items-center gap-2 hover:text-white">
              <Phone className="h-3.5 w-3.5" />
              <span>Twilio Contact: +13074540044</span>
            </a>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-safe-950 via-safe-900 to-safe-800 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex min-h-[78px] items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-warm-300 to-warm-500 text-safe-950 shadow-lg shadow-safe-950/20">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <Link href="/" className="block text-lg font-bold tracking-tight text-white">
                  Safe<span className="text-warm-400">Connect</span>
                </Link>
                <p className="text-[11px] uppercase tracking-[0.22em] text-safe-300">
                  Powered by Armstrong Pack Company
                </p>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-safe-300">Mission</p>
                <p className="text-sm font-medium text-white">Secure courier and neutral exchange support</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3">
              {!loading && email ? (
                <>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                    <p className="max-w-[220px] truncate text-xs text-safe-200">{email}</p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-safe-400">
                      {role ?? "member"}
                    </p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    Sign Out
                  </button>
                </>
              ) : !loading ? (
                <>
                  <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-medium text-safe-100 transition-colors hover:bg-white/10 hover:text-white">
                    Sign In
                  </Link>
                  <Link href="/signup" className="rounded-xl bg-warm-400 px-4 py-2 text-sm font-semibold text-safe-950 transition-colors hover:bg-warm-300">
                    Get Started
                  </Link>
                </>
              ) : null}

              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 md:hidden"
                aria-label="Toggle navigation menu"
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10 md:hidden"
              aria-label="Toggle navigation menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          <div className="hidden md:block border-t border-white/10 py-4">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_auto] lg:items-start">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-safe-400">Main Services</p>
                <div className="flex flex-wrap gap-2">
                  {visibleMain.map((item) => (
                    <NavChip key={item.href} item={item} />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-safe-400">Tools & Resources</p>
                <div className="flex flex-wrap gap-2">
                  {visibleTools.map((item) => (
                    <NavChip key={item.href} item={item} tone="tool" />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-safe-100">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-safe-400">Quick Support</p>
                <div className="space-y-1.5">
                  <Link href="/legal-aid" className="flex items-center gap-2 hover:text-white">
                    <Scale className="h-4 w-4 text-warm-400" />
                    <span>Legal Aid Portal</span>
                  </Link>
                  <Link href="/expungement" className="flex items-center gap-2 hover:text-white">
                    <BookOpen className="h-4 w-4 text-warm-400" />
                    <span>Expungement Support</span>
                  </Link>
                </div>
              </div>
            </div>

            {visibleAdmin.length > 0 && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-safe-400">Admin Console</p>
                <div className="flex flex-wrap gap-2">
                  {visibleAdmin.map((item) => (
                    <NavChip key={item.href} item={item} tone="tool" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-safe-200 bg-white md:hidden">
          <div className="mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6">
            <div className="rounded-2xl border border-safe-200 bg-safe-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-safe-500">Brand</p>
              <p className="mt-1 text-sm font-semibold text-safe-900">SafeConnect</p>
              <p className="text-xs text-safe-500">Powered by Armstrong Pack Company</p>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-safe-500">Main Services</p>
              <div className="space-y-1.5">
                {visibleMain.map((item) => (
                  <MobileLink key={item.href} item={item} />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-safe-500">Tools & Resources</p>
              <div className="space-y-1.5">
                {visibleTools.map((item) => (
                  <MobileLink key={item.href} item={item} />
                ))}
              </div>
            </div>

            {visibleAdmin.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-safe-500">Admin Console</p>
                <div className="space-y-1.5">
                  {visibleAdmin.map((item) => (
                    <MobileLink key={item.href} item={item} />
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-safe-200 bg-white px-4 py-4 shadow-card">
              <p className="text-sm font-semibold text-safe-900">You are not alone.</p>
              <p className="mt-1 text-xs text-safe-500">Help is available 24/7 through emergency services, legal aid, and survivor support.</p>
            </div>

            <div className="border-t border-safe-200 pt-4">
              {!loading && email ? (
                <div className="space-y-3">
                  <div>
                    <p className="truncate text-sm font-medium text-safe-900">{email}</p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-safe-500">{role ?? "member"}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full rounded-xl bg-safe-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-safe-800"
                  >
                    Sign Out
                  </button>
                </div>
              ) : !loading ? (
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/login" className="rounded-xl border border-safe-200 px-4 py-3 text-center text-sm font-medium text-safe-800 transition-colors hover:bg-safe-50">
                    Sign In
                  </Link>
                  <Link href="/signup" className="rounded-xl bg-warm-400 px-4 py-3 text-center text-sm font-semibold text-safe-950 transition-colors hover:bg-warm-300">
                    Get Started
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

