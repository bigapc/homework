import Link from "next/link"
import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import CourierStatusCard from "@/components/courier/CourierStatusCard"
import CourierChecklist from "@/components/courier/CourierChecklist"

export default async function CourierDashboardPage() {
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

  const { data: onboarding } = await supabase
    .from("courier_onboarding")
    .select("identity_verified,background_check_passed,training_completed,agreement_signed")
    .eq("courier_id", user.id)
    .maybeSingle()

  const isActive = Boolean(
    onboarding?.identity_verified &&
      onboarding?.background_check_passed &&
      onboarding?.training_completed &&
      onboarding?.agreement_signed
  )

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Approved Courier Dashboard</h1>
        <p className="mt-2 text-slate-600">Manage your onboarding, availability, assignments, and live location.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <CourierStatusCard role={profile.role} isActive={isActive} />
        <CourierChecklist
          identityVerified={Boolean(onboarding?.identity_verified)}
          backgroundCheckPassed={Boolean(onboarding?.background_check_passed)}
          trainingCompleted={Boolean(onboarding?.training_completed)}
          agreementSigned={Boolean(onboarding?.agreement_signed)}
        />
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-4">
        <Link href="/courier/assignments" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <h2 className="text-lg font-semibold text-slate-900">My Assignments</h2>
          <p className="mt-2 text-slate-600">View available, active, and completed courier assignments.</p>
        </Link>

        <Link href="/courier/tracking" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <h2 className="text-lg font-semibold text-slate-900">Live Tracking</h2>
          <p className="mt-2 text-slate-600">Toggle availability and share GPS location for dispatch.</p>
        </Link>

        <Link href="/courier/profile" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <h2 className="text-lg font-semibold text-slate-900">My Profile</h2>
          <p className="mt-2 text-slate-600">Manage vehicle details, rating visibility, and service range.</p>
        </Link>

        <Link href="/legal-aid" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
          <h2 className="text-lg font-semibold text-slate-900">Support</h2>
          <p className="mt-2 text-slate-600">Review confidentiality policy and request operational support.</p>
        </Link>
      </div>
    </div>
  )
}
