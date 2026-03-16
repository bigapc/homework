"use client"

import { useState } from "react"
import Link from "next/link"

export default function LegalAidPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    consultationType: "online",
    preferredDate: "",
    preferredTime: "",
    caseType: "",
    details: "",
  })
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.preferredDate || !form.caseType) {
      setError("Please fill in all required fields.")
      return
    }
    setError("")
    setSubmitted(true)
  }

  return (
    <div className="page-container">
      {/* Hero */}
      <div className="bg-safe-950 text-white py-14 px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="inline-block bg-warm-400/20 text-warm-400 text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full">
            Legal Aid
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold">Legal Aid Consultation Portal</h1>
          <p className="text-safe-300 text-sm leading-relaxed">
            Connect with a legal aid consultant in person or online. Confidential. No judgment.
            We help you understand your rights and take the next step.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-10">

        {/* Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="card space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏛️</span>
              <h2 className="font-semibold text-safe-100">In-Person Consultation</h2>
            </div>
            <p className="text-sm text-safe-400">
              Meet with a licensed legal consultant at a secure, confidential location —
              courthouses, legal aid offices, or neutral sites arranged by SafeConnect.
            </p>
          </div>
          <div className="card space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">💻</span>
              <h2 className="font-semibold text-safe-100">Online Consultation</h2>
            </div>
            <p className="text-sm text-safe-400">
              Video or phone consultation from a safe location of your choice. Fully encrypted
              and confidential. Available same-day in many areas.
            </p>
          </div>
        </div>

        {/* Booking Form */}
        <div className="card">
          <h2 className="text-lg font-semibold text-safe-100 mb-6">Request a Consultation</h2>

          {submitted ? (
            <div className="rounded-lg bg-green-900/40 border border-green-700 text-green-300 px-5 py-6 text-center space-y-2">
              <p className="font-semibold text-lg">Request Received</p>
              <p className="text-sm">
                Thank you, <strong>{form.name}</strong>. Your consultation request has been submitted.
                A legal aid coordinator will contact you at <strong>{form.email}</strong> within 1 business day.
              </p>
              <button
                onClick={() => { setSubmitted(false); setForm({ name: "", email: "", phone: "", consultationType: "online", preferredDate: "", preferredTime: "", caseType: "", details: "" }) }}
                className="mt-3 text-xs underline text-green-400 hover:text-white"
              >
                Submit another request
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="rounded-md bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-safe-400 mb-1">Full Name <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your name"
                    className="input-field w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-safe-400 mb-1">Email Address <span className="text-red-400">*</span></label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    className="input-field w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-safe-400 mb-1">Phone (optional)</label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+1 (307) 000-0000"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-safe-400 mb-1">Consultation Type <span className="text-red-400">*</span></label>
                  <select
                    name="consultationType"
                    value={form.consultationType}
                    onChange={handleChange}
                    className="input-field w-full"
                  >
                    <option value="online">Online (Video / Phone)</option>
                    <option value="in-person">In Person</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-safe-400 mb-1">Preferred Date <span className="text-red-400">*</span></label>
                  <input
                    type="date"
                    name="preferredDate"
                    value={form.preferredDate}
                    onChange={handleChange}
                    className="input-field w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-safe-400 mb-1">Preferred Time</label>
                  <input
                    type="time"
                    name="preferredTime"
                    value={form.preferredTime}
                    onChange={handleChange}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-safe-400 mb-1">Case Type <span className="text-red-400">*</span></label>
                <select
                  name="caseType"
                  value={form.caseType}
                  onChange={handleChange}
                  className="input-field w-full"
                  required
                >
                  <option value="">— Select a case type —</option>
                  <option value="protection_order">Protection Order</option>
                  <option value="custody">Child Custody</option>
                  <option value="expungement">Expungement / Record Clearing</option>
                  <option value="housing">Housing / Eviction</option>
                  <option value="immigration">Immigration</option>
                  <option value="probation">Probation / Parole</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-safe-400 mb-1">Additional Details (optional)</label>
                <textarea
                  name="details"
                  value={form.details}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Any additional context you'd like the consultant to know before your session…"
                  className="input-field w-full resize-none"
                />
              </div>

              <button type="submit" className="btn-primary w-full sm:w-auto">
                Submit Consultation Request
              </button>
            </form>
          )}
        </div>

        {/* National Line CTA */}
        <div className="card bg-safe-900/50 border border-safe-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-safe-100">Need immediate legal guidance?</p>
            <p className="text-xs text-safe-400">Dial the National Legal Aid Directory Line — available 24/7.</p>
          </div>
          <a href="tel:211" className="btn-secondary whitespace-nowrap">Call 211</a>
        </div>

        {/* Attorney Booking Link */}
        <div className="text-center text-sm text-safe-400">
          Looking to book directly with a licensed attorney?{" "}
          <Link href="/schedule" className="text-warm-400 hover:underline">
            Visit the Scheduling System →
          </Link>
        </div>

      </div>
    </div>
  )
}
