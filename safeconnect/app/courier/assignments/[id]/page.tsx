import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import CourierAssignmentDetail from "@/components/courier/CourierAssignmentDetail"

export default async function CourierAssignmentDetailPage({
  params,
}: {
  params: { id: string }
}) {
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

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (!profile || profile.role !== "courier") {
    redirect("/access-denied")
  }

  const { data: assignment, error } = await supabase
    .from("exchanges")
    .select("id,pickup,dropoff,status,created_at,items,vehicle_type,courier_id")
    .eq("id", params.id)
    .eq("courier_id", user.id)
    .single()

  if (error || !assignment) {
    redirect("/courier/assignments")
  }

  return <CourierAssignmentDetail assignment={assignment} />
}