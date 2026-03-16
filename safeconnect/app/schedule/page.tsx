"use client"

import { useState } from "react"
import Link from "next/link"

type AppointmentType = "attorney" | "legal-aid" | "court-prep" | "expungement" | "probation"

const APPOINTMENT_TYPES: { value: AppointmentType; label: string; desc: string }[] = [
  { value: "attorney", label: "Book with a Legal Attorney", desc: "Licensed attorney consultation for your legal matter." },
  { value: "legal-aid", label: "Legal Aid Consultant", desc: "Free or low-cost legal guidance through our aid network." },
  { value: "court-prep", label: "Court Preparation Session", desc: "Prepare documents and strategy before your court date." },
  { value: "expungement", label: "Expungement Review", desc: "Check your eligibility for record clearing and begin filing." },
  { value: "probation", label: "Probation / Parole Check-In Support", desc: "Guidance navigating probation meetings and compliance." },
]

export default function SchedulePage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedType, setSelectedType] = useState<AppointmentType | "">("")
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    preferredDate: "",
    preferredTime: "",
    notes: "",
    format: "online",
  })
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleTypeSelect(type: AppointmentType) {
    setSelectedType(type)
    setStep(2)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.preferredDate) {
      setError("Please fill in all required fields.")
      return
    }
    setError("")
    setSubmitted(true)
    setStep(3)
  }

  const selectedLabel = APPOINTMENT_TYPES.find((t) => t.value === selectedType)?.label ?? ""

  return (
    <div className="page-container">
      {/* Hero */}
      <div className="bg-safe-950 text-white py-14 px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="inline-block bg-warm-400/20 text-warm-400 text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full">
            Scheduling System
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold">Book an Appointment</h1>
          <p className="text-safe-300 text-sm leading-relaxed">
            Schedule time with a legal attorney, aid consultant, or support specialist.
            All sessions are confidential and available in person or online.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8">
        <ol className="flex items-center gap-2 text-xs font-medium text-safe-500">
          {["Choose Type", "Your Details", "Confirmed"].map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span className={`flex items-center justify-center w-6 h-6 rounded-full border text-[11px] font-bold
                ${step > i + 1 ? "bg-warm-400 border-warm-400 text-safe-900"
                  : step === i + 1 ? "border-warm-400 text-warm-400"
                  : "border-safe-700 text-safe-700"}`}>
                {step > i + 1 ? "✓" : i + 1}
              </span>
              <span className={step === i + 1 ? "text-safe-200" : ""}>{label}</span>
              {i < 2 && <span className="text-safe-800 mx-1">—</span>}
            </li>
          ))}
        </ol>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Step 1 — Select appointment type */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-safe-200">What type of appointment do you need?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {APPOINTMENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleTypeSelect(type.value)}
                  className="card text-left hover:border-warm-400 hover:bg-safe-900 transition-colors group"
                >
                  <p className="font-semibold text-sm text-safe-100 group-hover:text-warm-400 transition-colors">
                    {type.label}
                  </p>
                  <p className="text-xs text-safe-500 mt-1">{type.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Booking form */}
        {step === 2 && (
          <div className="card space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-safe-100">{selectedLabel}</h2>
              <button onClick={() => setStep(1)} className="text-xs text-safe-500 hover:text-warm-400 underline">
                ← Change type
              </button>
            </div>

            {error && (
              <div className="rounded-md bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-safe-400 mb-1">Full Name <span className="text-red-400">*</span></label>
                  <input type="text" name="name" value={form.name} onChange={handleChange} placeholder="Your name" className="input-field w-full" required />
                </div>
                <div>
                  <label className="block text-xs text-safe-400 mb-1">Email Address <span className="text-red-400">*</span></label>
                  <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" className="input-field w-full" required />
                </div>
                <div>
                  <label className="block text-xs text-safe-400 mb-1">Phone (optional)</label>
                  <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 (307) 000-0000" className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs text-safe-400 mb-1">Format <span className="text-red-400">*</span></label>
                  <select name="format" value={form.format} onChange={handleChange} className="input-field w-full">
                    <option value="online">Online (Video / Phone)</option>
                    <option value="in-person">In Person</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-safe-400 mb-1">Preferred Date <span className="text-red-400">*</span></label>
                  <input type="date" name="preferredDate" value={form.preferredDate} onChange={handleChange} className="input-field w-full" required />
                </div>
                <div>
                  <label className="block text-xs text-safe-400 mb-1">Preferred Time</label>
                  <input type="time" name="preferredTime" value={form.preferredTime} onChange={handleChange} className="input-field w-full" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-safe-400 mb-1">Notes (optional)</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Anything the specialist should know beforehand…" className="input-field w-full resize-none" />
              </div>
              <button type="submit" className="btn-primary w-full sm:w-auto">
                Confirm Appointment Request
              </button>
            </form>
          </div>
        )}

        {/* Step 3 — Confirmation */}
        {step === 3 && submitted && (
          <div className="card bg-green-900/30 border border-green-700 text-green-300 text-center space-y-3 py-8">
            <div className="text-4xl">✅</div>
            <p className="text-lg font-semibold text-white">Appointment Requested</p>
            <p className="text-sm">
              <strong>{form.name}</strong>, your <strong>{selectedLabel}</strong> appointment request has been received.
              We will confirm details at <strong>{form.email}</strong> within 1 business day.
            </p>
            <button
              onClick={() => { setStep(1); setSelectedType(""); setForm({ name: "", email: "", phone: "", preferredDate: "", preferredTime: "", notes: "", format: "online" }); setSubmitted(false) }}
              className="btn-secondary mt-2"
            >
              Book Another Appointment
            </button>
          </div>
        )}

        {/* Footer links */}
        {step === 1 && (
          <p className="text-center text-xs text-safe-500">
            Need a legal aid consultation?{" "}
            <Link href="/legal-aid" className="text-warm-400 hover:underline">Visit the Legal Aid Portal →</Link>
          </p>
        )}

      </div>
    </div>
  )
}
