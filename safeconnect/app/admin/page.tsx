"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type User = {
  id: string
  email: string
  role: string
  created_at: string
}

type Exchange = {
  id: string
  pickup: string
  dropoff: string
  status: string
  created_at: string
  user_id: string
  courier_id: string | null
  quoted_total_cents: number | null
  courier_payout_cents: number | null
}

type DashboardStats = {
  activeRequests: number
  pendingAssignments: number
  completedJobs: number
  totalRevenue: number
  totalPayouts: number
}

export default function AdminDashboard() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [activeTab, setActiveTab] = useState<"dashboard" | "requests" | "tracking" | "users" | "documents">("dashboard")

  // Dashboard data
  const [stats, setStats] = useState<DashboardStats>({
    activeRequests: 0,
    pendingAssignments: 0,
    completedJobs: 0,
    totalRevenue: 0,
    totalPayouts: 0,
  })
  const [recentExchanges, setRecentExchanges] = useState<Exchange[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [couriers, setCouriers] = useState<User[]>([])
  const [allExchanges, setAllExchanges] = useState<Exchange[]>([])

  const loadDashboardData = useCallback(async () => {
    setError("")

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      router.push("/login")
      return
    }

    const { data: me, error: meError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (meError) {
      setError(meError.message)
      setReady(true)
      return
    }

    if (!me || me.role !== "admin") {
      setError("Admin access required.")
      setReady(true)
      return
    }

    // Load dashboard stats
    const [
      { count: activeRequests },
      { count: pendingAssignments },
      { count: completedJobs },
      { data: revenueData },
      { data: payoutData },
      { data: recentExchangesData },
      { data: usersData },
      { data: couriersData },
      { data: allExchangesData },
    ] = await Promise.all([
      supabase.from("exchanges").select("*", { count: "exact", head: true }).neq("status", "completed"),
      supabase.from("exchanges").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("exchanges").select("*", { count: "exact", head: true }).eq("status", "completed"),
      supabase.from("exchange_payments").select("amount_cents").eq("status", "paid"),
      supabase.from("exchanges").select("courier_payout_cents").not("courier_payout_cents", "is", null),
      supabase.from("exchanges").select("id,pickup,dropoff,status,created_at,user_id,courier_id,quoted_total_cents,courier_payout_cents").order("created_at", { ascending: false }).limit(10),
      supabase.from("users").select("id,email,role,created_at").order("created_at", { ascending: false }),
      supabase.from("users").select("id,email,role,created_at").eq("role", "courier").order("email", { ascending: true }),
      supabase.from("exchanges").select("id,pickup,dropoff,status,created_at,user_id,courier_id,quoted_total_cents,courier_payout_cents").order("created_at", { ascending: false }),
    ])

    const totalRevenue = revenueData?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0
    const totalPayouts = payoutData?.reduce((sum, p) => sum + (p.courier_payout_cents || 0), 0) || 0

    setStats({
      activeRequests: activeRequests || 0,
      pendingAssignments: pendingAssignments || 0,
      completedJobs: completedJobs || 0,
      totalRevenue,
      totalPayouts,
    })
    setRecentExchanges(recentExchangesData || [])
    setUsers(usersData || [])
    setCouriers(couriersData || [])
    setAllExchanges(allExchangesData || [])
    setReady(true)
  }, [router])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const promoteToAdmin = async (userId: string) => {
    const { error } = await supabase
      .from("users")
      .update({ role: "admin" })
      .eq("id", userId)

    if (error) {
      setError(error.message)
    } else {
      setNotice("User promoted to admin successfully.")
      loadDashboardData()
    }
  }

  const assignCourier = async (exchangeId: string, courierId: string) => {
    const { error } = await supabase
      .from("exchanges")
      .update({ courier_id: courierId, status: "assigned" })
      .eq("id", exchangeId)

    if (error) {
      setError(error.message)
    } else {
      setNotice("Courier assigned successfully.")
      loadDashboardData()
    }
  }

  const updateExchangeStatus = async (exchangeId: string, status: string) => {
    const { error } = await supabase
      .from("exchanges")
      .update({ status })
      .eq("id", exchangeId)

    if (error) {
      setError(error.message)
    } else {
      setNotice(`Exchange status updated to ${status}.`)
      loadDashboardData()
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-safe-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-safe-600 mx-auto mb-4"></div>
          <p className="text-safe-600">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-safe-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-safe-900">Admin Control Center</h1>
          <p className="text-safe-600 mt-2">Manage SafeConnect operations and monitor performance</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {notice && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 text-sm">{notice}</p>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-8 bg-white p-1 rounded-lg shadow-sm overflow-x-auto">
          {[
            { id: "dashboard", label: "Dashboard", icon: "📊" },
            { id: "requests", label: "Request Management", icon: "📦" },
            { id: "tracking", label: "Live Tracking", icon: "🗺" },
            { id: "users", label: "User Management", icon: "👤" },
            { id: "documents", label: "Document Center", icon: "📁" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-safe-600 text-white"
                  : "text-safe-600 hover:bg-safe-50"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <span className="text-blue-600 text-xl">📋</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-safe-600">Active Requests</p>
                    <p className="text-2xl font-bold text-safe-900">{stats.activeRequests}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <span className="text-yellow-600 text-xl">⏳</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-safe-600">Pending Assignments</p>
                    <p className="text-2xl font-bold text-safe-900">{stats.pendingAssignments}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <span className="text-green-600 text-xl">✅</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-safe-600">Completed Jobs</p>
                    <p className="text-2xl font-bold text-safe-900">{stats.completedJobs}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-warm-100 rounded-lg">
                    <span className="text-warm-600 text-xl">💰</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-safe-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-safe-900">${(stats.totalRevenue / 100).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <span className="text-purple-600 text-xl">💸</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-safe-600">Courier Payouts</p>
                    <p className="text-2xl font-bold text-safe-900">${(stats.totalPayouts / 100).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Exchanges */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-safe-900 mb-4">Recent Exchanges</h2>
              <div className="space-y-4">
                {recentExchanges.map((exchange) => (
                  <div key={exchange.id} className="flex items-center justify-between p-4 border border-safe-100 rounded-lg">
                    <div>
                      <p className="font-medium text-safe-900">
                        {exchange.pickup} → {exchange.dropoff}
                      </p>
                      <p className="text-sm text-safe-500">
                        Status: <span className={`font-medium ${
                          exchange.status === 'completed' ? 'text-green-600' :
                          exchange.status === 'assigned' ? 'text-blue-600' :
                          'text-yellow-600'
                        }`}>{exchange.status}</span>
                        {exchange.quoted_total_cents && (
                          <span className="ml-4">
                            Revenue: ${(exchange.quoted_total_cents / 100).toFixed(2)}
                          </span>
                        )}
                        {exchange.courier_payout_cents && (
                          <span className="ml-4">
                            Payout: ${(exchange.courier_payout_cents / 100).toFixed(2)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-sm text-safe-500">
                      {new Date(exchange.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Request Management Tab */}
        {activeTab === "requests" && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-safe-900 mb-4">Request Management</h2>
            <div className="space-y-4">
              {allExchanges.map((exchange) => (
                <div key={exchange.id} className="border border-safe-100 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-safe-900">Exchange #{exchange.id.slice(-8)}</h3>
                      <p className="text-sm text-safe-600">
                        From: {exchange.pickup}
                        <br />
                        To: {exchange.dropoff}
                      </p>
                      <p className="text-sm text-safe-600 mt-2">
                        Requested: {new Date(exchange.created_at).toLocaleString()}
                      </p>
                      {exchange.quoted_total_cents && (
                        <p className="text-sm font-semibold text-warm-600 mt-1">
                          Quote: ${(exchange.quoted_total_cents / 100).toFixed(2)}
                        </p>
                      )}
                      {exchange.courier_payout_cents && (
                        <p className="text-sm font-semibold text-purple-600 mt-1">
                          Courier Payout: ${(exchange.courier_payout_cents / 100).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${
                        exchange.status === 'completed' ? 'bg-green-100 text-green-800' :
                        exchange.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {exchange.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {exchange.status === 'pending' && (
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            assignCourier(exchange.id, e.target.value)
                            e.target.value = ''
                          }
                        }}
                        className="px-3 py-2 border border-safe-300 rounded-md text-sm"
                        defaultValue=""
                      >
                        <option value="">Assign Courier</option>
                        {couriers.map((courier) => (
                          <option key={courier.id} value={courier.id}>
                            {courier.email}
                          </option>
                        ))}
                      </select>
                    )}

                    {exchange.status === 'assigned' && (
                      <button
                        onClick={() => updateExchangeStatus(exchange.id, 'in transit')}
                        className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Mark In Transit
                      </button>
                    )}

                    {exchange.status === 'in transit' && (
                      <button
                        onClick={() => updateExchangeStatus(exchange.id, 'completed')}
                        className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Mark Completed
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Tracking Tab */}
        {activeTab === "tracking" && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-safe-900 mb-4">Live Tracking Panel</h2>
            <p className="text-safe-600">Real-time courier tracking with map integration will be implemented here.</p>
            {/* TODO: Implement Mapbox integration for live tracking */}
          </div>
        )}

        {/* User Management Tab */}
        {activeTab === "users" && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-safe-900 mb-4">User Management</h2>
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border border-safe-100 rounded-lg">
                  <div>
                    <p className="font-medium text-safe-900">{user.email}</p>
                    <p className="text-sm text-safe-500">
                      Role: <span className={`font-medium ${
                        user.role === 'admin' ? 'text-red-600' :
                        user.role === 'courier' ? 'text-blue-600' :
                        'text-green-600'
                      }`}>{user.role}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-safe-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                    {user.role !== 'admin' && (
                      <button
                        onClick={() => promoteToAdmin(user.id)}
                        className="px-3 py-1 bg-safe-600 text-white text-sm rounded hover:bg-safe-700 transition-colors"
                      >
                        Promote to Admin
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Document Center Tab */}
        {activeTab === "documents" && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-safe-900 mb-4">Document Center</h2>
            <p className="text-safe-600">Secure document management for legal and property documents will be implemented here.</p>
            {/* TODO: Implement document upload/view/management */}
          </div>
        )}
      </div>
    </div>
  )
}
