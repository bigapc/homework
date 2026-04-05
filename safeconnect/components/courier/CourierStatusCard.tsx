export default function CourierStatusCard({
  role,
  isActive,
}: {
  role: string
  isActive: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Account Status</h2>

      <div className="mt-4 flex items-center gap-3">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Role: {role}</span>

        <span
          className={`rounded-full px-3 py-1 ${
            isActive ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {isActive ? "Active" : "Onboarding In Progress"}
        </span>
      </div>

      <p className="mt-4 text-slate-600">
        {isActive
          ? "Your account is active. You are eligible to receive courier assignments."
          : "Complete the remaining onboarding requirements before assignments are unlocked."}
      </p>
    </div>
  )
}
