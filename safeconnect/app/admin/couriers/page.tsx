import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { getServerAdminSupabase } from "@/lib/serverAdminSupabase"
import CourierApplicationsTable from "@/components/admin/CourierApplicationsTable"

export default async function AdminCouriersPage() {
  const supabase = await createSupabaseServerClient()

  if (!supabase) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Courier Applications</h1>
        <p className="mt-4 text-red-600">Supabase server client is not configured.</p>
      </div>
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (!me || me.role !== "admin") {
    redirect("/access-denied")
  }

  const adminClient = getServerAdminSupabase()

  if (!adminClient) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Courier Applications</h1>
        <p className="mt-4 text-red-600">Admin Supabase client not configured.</p>
      </div>
    )
  }

  const { data: applications, error } = await adminClient
    .from("courier_applications")
    .select("id,user_id,first_name,last_name,email,phone,city,state,vehicle_type,vehicle,motivation,background_check_consent,status,created_at,service_radius_miles,willing_to_commute_miles,latitude,longitude")
    .order("created_at", { ascending: false })

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Courier Applications</h1>
        <p className="mt-4 text-red-600">Failed to load applications.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Admin Courier Review Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Review applicants, map service coverage, update status, and activate approved couriers.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Checklist</h2>
        <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li>Verify identity and background consent</li>
          <li>Validate vehicle type and commute radius</li>
          <li>Confirm map location visibility for dispatch</li>
          <li>Approve and activate courier profile</li>
          <li>Ensure courier is visible to dispatcher matching</li>
        </ul>
      </div>

      <CourierApplicationsTable applications={applications || []} />
    </div>
  )
}
