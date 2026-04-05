function Item({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-slate-800">{label}</span>
      <span
        className={`rounded-full px-3 py-1 text-sm ${
          done ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
        }`}
      >
        {done ? "Complete" : "Pending"}
      </span>
    </div>
  )
}

export default function CourierChecklist({
  identityVerified,
  backgroundCheckPassed,
  trainingCompleted,
  agreementSigned,
}: {
  identityVerified: boolean
  backgroundCheckPassed: boolean
  trainingCompleted: boolean
  agreementSigned: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Activation Checklist</h2>

      <div className="mt-4 space-y-3">
        <Item label="Identity verified" done={identityVerified} />
        <Item label="Background check passed" done={backgroundCheckPassed} />
        <Item label="Training completed" done={trainingCompleted} />
        <Item label="Agreement signed" done={agreementSigned} />
      </div>
    </div>
  )
}
