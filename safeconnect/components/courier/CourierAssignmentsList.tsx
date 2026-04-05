import Link from "next/link"

type Assignment = {
  id: string
  pickup: string
  dropoff: string
  status: string
  created_at: string
  vehicle_type?: string | null
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    assigned: "bg-blue-100 text-blue-700",
    in_transit: "bg-indigo-100 text-indigo-700",
    picked_up: "bg-purple-100 text-purple-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  }

  return (
    <span className={`rounded-full px-3 py-1 text-sm ${styles[status] || "bg-slate-100 text-slate-700"}`}>
      {status.replace("_", " ")}
    </span>
  )
}

export default function CourierAssignmentsList({
  title,
  assignments,
}: {
  title: string
  assignments: Assignment[]
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>

      {assignments.length === 0 ? (
        <p className="mt-4 text-slate-500">No assignments in this section.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium text-slate-900">Assignment #{assignment.id.slice(0, 8)}</p>
                  <p className="mt-1 text-slate-600">
                    <span className="font-medium">Pickup:</span> {assignment.pickup}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-medium">Dropoff:</span> {assignment.dropoff}
                  </p>
                  {assignment.vehicle_type ? (
                    <p className="text-slate-600">
                      <span className="font-medium">Vehicle:</span> {assignment.vehicle_type}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-slate-500">Created {new Date(assignment.created_at).toLocaleString()}</p>
                </div>

                <div className="flex flex-col gap-2 md:items-end">
                  <StatusBadge status={assignment.status} />
                  <Link
                    href={`/courier/assignments/${assignment.id}`}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-center text-white"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
