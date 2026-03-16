"use client"

import { useState } from "react"
import Link from "next/link"

const ELIGIBILITY_QUESTIONS = [
  { id: "felony", label: "Do you have any felony convictions on your record?" },
  { id: "misdemeanor", label: "Do you have any misdemeanor convictions?" },
  { id: "arrest_no_conviction", label: "Do you have any arrests with no conviction?" },
  { id: "probation_complete", label: "Have you completed all probation or parole requirements?" },
  { id: "waiting_period", label: "Has it been at least 3 years since your last offense?" },
]

export default function ExpungementPage() {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  const [requestForm, setRequestForm] = useState({ name: "", email: "", details: "" })
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState("")

  function handleAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }))
    setChecked(false)
  }

  const allAnswered = ELIGIBILITY_QUESTIONS.every((q) => answers[q.id])
  const likelyEligible =
    answers["arrest_no_conviction"] === "yes" ||
    (answers["probation_complete"] === "yes" && answers["waiting_period"] === "yes" && answers["felony"] === "no")

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setRequestForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!requestForm.name || !requestForm.email) {
      setFormError("Name and email are required.")
      return
    }
    setFormError("")
    setSubmitted(true)
  }

  return (
    <div className="page-container">
      {/* Hero */}
      <div className="bg-safe-950 text-white py-14 px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="inline-block bg-warm-400/20 text-warm-400 text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full">
            Expungement Support
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold">Clear Your Record. Reclaim Your Future.</h1>
          <p className="text-safe-300 text-sm leading-relaxed">
            SafeConnect offers confidential expungement support — from eligibility reviews
            to mugshot removal, filing assistance, and confidential processing.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-12">

        {/* Services Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            { icon: "🗑️", title: "Mugshot Removal", desc: "We assist in submitting takedown requests to mugshot websites and data brokers to protect your privacy." },
            { icon: "📋", title: "Record Clearing Eligibility Review", desc: "We'll review your full record and determine which charges may qualify for sealing or expungement under your state's law." },
            { icon: "📝", title: "Filing Assistance", desc: "Our team helps you prepare and submit all required petitions, court forms, and supporting documentation." },
            { icon: "🔒", title: "Confidential Processing", desc: "All case details and documents are handled with strict confidentiality — no public exposure during the process." },
          ].map((item) => (
            <div key={item.title} className="card space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{item.icon}</span>
                <h2 className="font-semibold text-safe-100">{item.title}</h2>
              </div>
              <p className="text-sm text-safe-400">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Eligibility Checker */}
        <div className="card space-y-5">
          <h2 className="text-lg font-semibold text-safe-100">Quick Eligibility Check</h2>
          <p className="text-xs text-safe-500">Answer the questions below to get a preliminary assessment. This is not legal advice.</p>

          <div className="space-y-4">
            {ELIGIBILITY_QUESTIONS.map((q) => (
              <div key={q.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-safe-800 pb-3">
                <p className="text-sm text-safe-300">{q.label}</p>
                <div className="flex gap-3 text-sm">
                  {["yes", "no"].map((val) => (
                    <label key={val} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={q.id}
                        value={val}
                        checked={answers[q.id] === val}
                        onChange={() => handleAnswer(q.id, val)}
                        className="accent-warm-400"
                      />
                      <span className={`capitalize ${answers[q.id] === val ? "text-warm-400 font-medium" : "text-safe-500"}`}>{val}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {allAnswered && !checked && (
            <button onClick={() => setChecked(true)} className="btn-primary">Check Eligibility</button>
          )}

          {checked && (
            <div className={`rounded-lg px-5 py-4 border text-sm ${likelyEligible
              ? "bg-green-900/30 border-green-700 text-green-300"
              : "bg-yellow-900/30 border-yellow-700 text-yellow-300"}`}>
              {likelyEligible ? (
                <>
                  <p className="font-semibold">You may be eligible for expungement or record sealing.</p>
                  <p className="mt-1 text-xs">We recommend scheduling a full eligibility review with one of our consultants to confirm and begin the process.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Your eligibility is not immediately clear.</p>
                  <p className="mt-1 text-xs">This does not mean you are ineligible. A full case review by a consultant is the best next step to explore your options.</p>
                </>
              )}
              <Link href="/schedule" className="inline-block mt-3 text-xs underline hover:opacity-80">
                Schedule a full review →
              </Link>
            </div>
          )}
        </div>

        {/* Request Filing Assistance */}
        <div className="card space-y-5">
          <h2 className="text-lg font-semibold text-safe-100">Request Filing Assistance</h2>

          {submitted ? (
            <div className="rounded-lg bg-green-900/40 border border-green-700 text-green-300 px-5 py-6 text-center space-y-2">
              <p className="font-semibold">Request Received</p>
              <p className="text-sm">We will reach out to <strong>{requestForm.email}</strong> within 1–2 business days to begin your case review.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-md bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 text-sm">{formError}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-safe-400 mb-1">Full Name <span className="text-red-400">*</span></label>
                  <input type="text" name="name" value={requestForm.name} onChange={handleFormChange} placeholder="Your name" className="input-field w-full" required />
                </div>
                <div>
                  <label className="block text-xs text-safe-400 mb-1">Email Address <span className="text-red-400">*</span></label>
                  <input type="email" name="email" value={requestForm.email} onChange={handleFormChange} placeholder="you@example.com" className="input-field w-full" required />
                </div>
              </div>
              <div>
                <label className="block text-xs text-safe-400 mb-1">Brief description of your situation (optional)</label>
                <textarea name="details" value={requestForm.details} onChange={handleFormChange} rows={3} placeholder="e.g. misdemeanor from 2018, completed probation…" className="input-field w-full resize-none" />
              </div>
              <button type="submit" className="btn-primary w-full sm:w-auto">Submit Request</button>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}
