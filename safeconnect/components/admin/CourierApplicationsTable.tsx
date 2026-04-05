"use client"

import { useState } from "react"

type Application = {
  id: string
  user_id?: string | null
  first_name: string
  last_name: string
  email: string
  phone: string
  city: string
  state: string
  vehicle_type: string | null
  vehicle: string | null
  service_radius_miles: number | null
  willing_to_commute_miles: number | null
  latitude: number | null
  longitude: number | null
  motivation: string
  background_check_consent?: boolean | null
  status: string
  created_at: string
}

export default function CourierApplicationsTable({
  applications,
}: {
  applications: Application[]
}) {
  const [rows, setRows] = useState(applications)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function updateStatus(id: string, status: string) {
    setLoadingId(id)

    const res = await fetch("/api/admin/couriers/update-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, status }),
    })

    if (res.ok) {
      setRows((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)))
    } else {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null
      alert(payload?.error || "Failed to update application.")
    }

    setLoadingId(null)
  }

  async function activateCourier(applicationId: string) {
    setLoadingId(applicationId)

    const res = await fetch("/api/admin/couriers/activate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ applicationId }),
    })

    if (res.ok) {
      setRows((prev) => prev.map((row) => (row.id === applicationId ? { ...row, status: "active" } : row)))
      alert("Courier activated successfully.")
    } else {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      alert(data?.error || "Failed to activate courier.")
    }

    setLoadingId(null)
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-slate-700">
            <th className="p-4">Applicant</th>
            <th className="p-4">Coverage</th>
            <th className="p-4">Transport</th>
            <th className="p-4">Live Location</th>
            <th className="p-4">Status</th>
            <th className="p-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((app) => (
            <tr key={app.id} className="border-t border-slate-100 align-top">
              <td className="p-4">
                <div className="font-medium text-slate-900">
                  {app.first_name} {app.last_name}
                </div>
                <div className="text-slate-600">{app.email}</div>
                <div className="text-slate-600">{app.phone}</div>
                <div className="mt-2 text-slate-500 text-xs">Applied {new Date(app.created_at).toLocaleDateString()}</div>
                <div className="mt-3 text-slate-700">
                  <span className="font-medium">Why they applied:</span>
                  <p className="mt-1 text-slate-600">{app.motivation}</p>
                </div>
              </td>

              <td className="p-4 text-slate-700">
                <div>{app.city}, {app.state}</div>
                <div className="text-xs text-slate-500 mt-2">Radius: {app.service_radius_miles ?? 25} mi</div>
                <div className="text-xs text-slate-500">Commute: {app.willing_to_commute_miles ?? 50} mi</div>
              </td>

              <td className="p-4 text-slate-700">
                <div>{app.vehicle_type || "standard"}</div>
                <div className="text-xs text-slate-500 mt-1">{app.vehicle || "No description"}</div>
              </td>

              <td className="p-4 text-slate-700">
                {typeof app.latitude === "number" && typeof app.longitude === "number" ? (
                  <div>
                    <div className="text-xs">Lat: {app.latitude.toFixed(5)}</div>
                    <div className="text-xs">Lng: {app.longitude.toFixed(5)}</div>
                    <a
                      className="text-xs text-blue-700 underline"
                      href={`https://www.google.com/maps?q=${app.latitude},${app.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Map
                    </a>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">No location shared</span>
                )}
              </td>

              <td className="p-4">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{app.status}</span>
              </td>

              <td className="p-4">
                <div className="flex flex-col gap-2 min-w-[190px]">
                  <button
                    onClick={() => updateStatus(app.id, "reviewing")}
                    disabled={loadingId === app.id}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-white"
                  >
                    Move to Reviewing
                  </button>

                  <button
                    onClick={() => updateStatus(app.id, "approved")}
                    disabled={loadingId === app.id}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-white"
                  >
                    Approve
                  </button>

                  <button
                    onClick={() => activateCourier(app.id)}
                    disabled={loadingId === app.id}
                    className="rounded-xl bg-green-600 px-4 py-2 text-white"
                  >
                    Activate Courier
                  </button>

                  <button
                    onClick={() => updateStatus(app.id, "rejected")}
                    disabled={loadingId === app.id}
                    className="rounded-xl bg-red-600 px-4 py-2 text-white"
                  >
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="p-6 text-center text-slate-500">
                No courier applications found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
