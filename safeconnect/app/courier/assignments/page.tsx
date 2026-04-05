import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import CourierAssignmentsList from "@/components/courier/CourierAssignmentsList"

export default async function CourierAssignmentsPage() {
  const supabase = await createSupabaseServerClient()

  if (!supabase) {
    redirect("/login")
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/login")
  }

  const { data: profile } = await supabase.from("users").select("id, role").eq("id", user.id).single()

  if (!profile || profile.role !== "courier") {
    redirect("/access-denied")
  }

  const { data: assignments, error } = await supabase
    .from("exchanges")
    .select("id,pickup,dropoff,status,created_at,courier_id,vehicle_type")
    .eq("courier_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-slate-900">My Assignments</h1>
        <p className="mt-4 text-red-600">Failed to load assignments.</p>
      </div>
    )
  }

  const allAssignments = assignments || []
  const activeAssignments = allAssignments.filter((a) => ["assigned", "in_transit", "picked_up"].includes(a.status))
  const completedAssignments = allAssignments.filter((a) => a.status === "completed")
  const pendingAssignments = allAssignments.filter((a) => a.status === "pending")

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">My Assignments</h1>
        <p className="mt-2 text-slate-600">Review your current and completed SafeConnect assignments.</p>
      </div>

      <div className="space-y-8">
        <CourierAssignmentsList title="Active Assignments" assignments={activeAssignments} />
        <CourierAssignmentsList title="Pending Assignments" assignments={pendingAssignments} />
        <CourierAssignmentsList title="Completed Assignments" assignments={completedAssignments} />
      </div>
    </div>
  )
}
