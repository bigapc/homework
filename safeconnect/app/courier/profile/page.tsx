import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase-server"

export default async function CourierProfilePage() {
  const supabase = await createSupabaseServerClient()

  if (!supabase) {
    redirect("/login")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: roleRow } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (!roleRow || roleRow.role !== "courier") {
    redirect("/access-denied")
  }

  const { data: courier } = await supabase
    .from("couriers")
    .select("first_name,last_name,phone,vehicle_type,vehicle_description,service_radius_miles,willing_to_commute_miles,rating,total_deliveries,status,last_location_update_at")
    .eq("user_id", user.id)
    .maybeSingle()

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Courier Profile</h1>
      <p className="text-slate-600">This profile is used by dispatchers and visible to pickup/dropoff parties for trust and accountability.</p>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Name</p>
          <p className="text-slate-900 font-semibold">{courier ? `${courier.first_name} ${courier.last_name}` : "Not set"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Phone</p>
          <p className="text-slate-900 font-semibold">{courier?.phone || "Not set"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Vehicle Type</p>
          <p className="text-slate-900 font-semibold">{courier?.vehicle_type || "Not set"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Vehicle Description</p>
          <p className="text-slate-900 font-semibold">{courier?.vehicle_description || "Not set"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Service Radius</p>
          <p className="text-slate-900 font-semibold">{courier?.service_radius_miles ?? 0} miles</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Willing To Commute</p>
          <p className="text-slate-900 font-semibold">{courier?.willing_to_commute_miles ?? 0} miles</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Driver Rating</p>
          <p className="text-slate-900 font-semibold">{courier?.rating ?? 0}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Driving Career</p>
          <p className="text-slate-900 font-semibold">{courier?.total_deliveries ?? 0} completed deliveries</p>
        </div>
      </div>
    </div>
  )
}
