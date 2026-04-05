import { redirect } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { getServerAdminSupabase } from "@/lib/serverAdminSupabase"

const checklist = [
  "Legal Aid Consultation Portal (In Person + Online)",
  "Scheduling System",
  "Courthouse, Government Agencies, and Probation Directory",
  "National Directory Line 211 routing",
  "Book an Appointment with a Legal Attorney",
  "Expungement Support resource compatibility",
  "Plugin availability and partner integrations",
  "Co-branded portal visibility under Armstrong Pack Company",
]

const todo = [
  "Add partner intake form for LegalAid personnel and probation offices",
  "Add API webhooks for partner plugin integrations",
  "Add verification workflow for agency partners",
  "Add quarterly reporting dashboard for partner usage",
  "Add SLA monitoring for high-collaboration emergency assignments",
]

export default async function AdminPartnershipsPage() {
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

  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single()

  if (!me || me.role !== "admin") {
    redirect("/access-denied")
  }

  const adminClient = getServerAdminSupabase()
  const { data: services } = adminClient
    ? await adminClient
        .from("partner_services")
        .select("id,partner_name,partner_type,integration_mode,scheduling_supported,supports_online_consultation,supports_in_person_consultation,supports_expungement,supports_211_routing,service_url,status")
        .order("partner_name", { ascending: true })
    : { data: [] }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Backend Partnership Operations Portal</h1>
        <p className="mt-2 text-slate-600">
          Operational checklist and growth roadmap for agency partnerships under Armstrong Pack Company branding.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Live Partner Services</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(services || []).map((service) => (
            <div key={service.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{service.partner_name}</h3>
                  <p className="text-sm text-slate-600 capitalize">
                    {service.partner_type.replace(/_/g, " ")} · {service.integration_mode}
                  </p>
                </div>
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 capitalize">
                  {service.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {service.scheduling_supported ? <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">Scheduling</span> : null}
                {service.supports_online_consultation ? <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-indigo-700">Online</span> : null}
                {service.supports_in_person_consultation ? <span className="rounded-full bg-purple-100 px-2.5 py-1 text-purple-700">In Person</span> : null}
                {service.supports_expungement ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">Expungement</span> : null}
                {service.supports_211_routing ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">211 Routing</span> : null}
              </div>

              <p className="text-sm text-slate-600">Route: {service.service_url || "No route configured"}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Checklist</h2>
        <ul className="mt-4 list-disc pl-5 space-y-2 text-slate-700">
          {checklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">To-Do List</h2>
        <ul className="mt-4 list-disc pl-5 space-y-2 text-slate-700">
          {todo.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
