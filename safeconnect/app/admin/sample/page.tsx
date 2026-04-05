import Link from "next/link"

const cards = [
  { title: "Pending Courier Applications", value: "14", tone: "text-amber-600" },
  { title: "Active Dispatches", value: "8", tone: "text-blue-600" },
  { title: "Completed Today", value: "22", tone: "text-emerald-600" },
  { title: "Incident Reviews", value: "3", tone: "text-rose-600" },
]

export default function AdminSamplePage() {
  return (
    <div className="min-h-screen bg-safe-50">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-safe-500">Sample Preview</p>
            <h1 className="mt-2 text-3xl font-bold text-safe-900">Admin Control Center (Preview)</h1>
            <p className="mt-2 text-safe-600">
              This is a non-sensitive sample page while role access is being finalized.
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-xl bg-safe-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-safe-800"
          >
            Try Live Admin
          </Link>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-safe-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-safe-500">{card.title}</p>
              <p className={`mt-3 text-3xl font-bold ${card.tone}`}>{card.value}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-safe-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-safe-900">Recent Queue</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-safe-200 text-safe-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Reference</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-safe-100">
                  <td className="px-3 py-3">Courier Application</td>
                  <td className="px-3 py-3">APP-4821</td>
                  <td className="px-3 py-3 text-amber-700">Reviewing</td>
                  <td className="px-3 py-3">2m ago</td>
                </tr>
                <tr className="border-b border-safe-100">
                  <td className="px-3 py-3">Incident Report</td>
                  <td className="px-3 py-3">INC-191</td>
                  <td className="px-3 py-3 text-rose-700">Needs Follow-up</td>
                  <td className="px-3 py-3">6m ago</td>
                </tr>
                <tr>
                  <td className="px-3 py-3">Dispatch Assignment</td>
                  <td className="px-3 py-3">DSP-770</td>
                  <td className="px-3 py-3 text-emerald-700">Assigned</td>
                  <td className="px-3 py-3">11m ago</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
