"use client"

import { useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

const STEPS = [
  {
    icon: "📋",
    title: "Apply",
    desc: "Submit your application and background-check consent.",
  },
  {
    icon: "🔍",
    title: "Screening",
    desc: "We verify your identity and run a background check (typically 2–3 days).",
  },
  {
    icon: "🎓",
    title: "Training",
    desc: "Complete a 30-minute online safety and protocol training module.",
  },
  {
    icon: "✅",
    title: "Activated",
    desc: "Your account is upgraded to courier status. Start accepting assignments.",
  },
]

const REQUIREMENTS = [
  "Valid government-issued photo ID",
  "Clean background check (no violent offenses)",
  "Reliable transportation (car or rideshare)",
  "Smartphone with GPS capability",
  "18 years of age or older",
  "Commitment to neutrality and confidentiality",
]

export default function CourierOnboarding() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    vehicle: "",
    motivation: "",
    consent: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.consent) {
      setError("Please consent to the background check to proceed.")
      return
    }
    setSubmitting(true)
    setError("")

    const { error: dbError } = await supabase.from("courier_applications").insert({
      first_name:  form.firstName,
      last_name:   form.lastName,
      email:       form.email,
      phone:       form.phone,
      city:        form.city,
      state:       form.state,
      vehicle:     form.vehicle,
      motivation:  form.motivation,
    })

    if (dbError) {
      setError("We could not submit your application right now. Please try again in a moment.")
      setSubmitting(false)
      return
    }

    setSubmitted(true)
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="page-container animate-fade-in">
        <div className="card-lg text-center space-y-5 max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto text-3xl">
            ✅
          </div>
          <h2 className="text-2xl font-bold text-safe-900">Application Received!</h2>
          <p className="text-safe-500 text-sm leading-relaxed">
            Thank you for applying to become a SafeConnect courier. Our team will review
            your application and contact you at <strong className="text-safe-800">{form.email}</strong> within 3–5 business days.
          </p>
          <div className="divider" />
          <div className="space-y-2 text-left text-sm text-safe-600">
            <p className="font-semibold text-safe-800">What happens next?</p>
            {STEPS.map((s) => (
              <div key={s.title} className="flex gap-3 items-start">
                <span className="text-base shrink-0">{s.icon}</span>
                <div>
                  <span className="font-medium text-safe-800">{s.title}: </span>
                  {s.desc}
                </div>
              </div>
            ))}
          </div>
          <Link href="/" className="btn-primary w-full justify-center">
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-0 animate-fade-in">

      {/* Hero */}
      <section className="bg-safe-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 bg-safe-800 border border-safe-700 rounded-full px-4 py-1.5 text-xs font-semibold text-warm-400 tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-warm-400 animate-pulse-soft" />
              Now Accepting Couriers
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">
              Become a SafeConnect{" "}
              <span className="text-warm-400">Courier</span>
            </h1>
            <p className="text-safe-200 text-lg leading-relaxed max-w-lg">
              Help survivors safely recover their belongings — no confrontation, no risk.
              Join a network of trusted, screened couriers making a real difference.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              {["Flexible hours", "Competitive pay", "Meaningful work"].map((b) => (
                <span key={b} className="flex items-center gap-1.5 text-safe-100">
                  <span className="text-warm-400 font-bold">✓</span> {b}
                </span>
              ))}
            </div>
          </div>

          {/* Process steps on hero */}
          <div className="hidden lg:grid grid-cols-2 gap-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="bg-safe-800 border border-safe-700 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{step.icon}</span>
                  <span className="text-xs font-bold text-warm-400 uppercase tracking-wide">Step {i + 1}</span>
                </div>
                <p className="font-semibold text-white text-sm">{step.title}</p>
                <p className="text-xs text-safe-300 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Requirements */}
      <section className="bg-safe-50 border-b border-safe-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <h2 className="text-xl font-bold text-safe-900 mb-5">Requirements</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {REQUIREMENTS.map((req) => (
              <div key={req} className="flex items-start gap-3 bg-white rounded-xl border border-safe-100 px-4 py-3 shadow-card">
                <span className="text-emerald-500 font-black text-sm mt-0.5 shrink-0">✓</span>
                <p className="text-sm text-safe-700">{req}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Application form */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-safe-900">Apply to Join</h2>
          <p className="text-safe-500 text-sm">All information is kept strictly confidential.</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-6">
          {error && <div className="alert-error">{error}</div>}

          {/* Personal info */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-safe-400 mb-3">Personal Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">First Name</label>
                <input className="input" placeholder="Jane" required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input className="input" placeholder="Smith" required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <div>
                <label className="label">Email Address</label>
                <input className="input" type="email" placeholder="jane@example.com" required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input className="input" type="tel" placeholder="(555) 000-0000" required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Location + transport */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-safe-400 mb-3">Location &amp; Transport</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="label">City</label>
                <input className="input" placeholder="Austin" required
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <label className="label">State</label>
                <input className="input" placeholder="TX" maxLength={2} required
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />
              </div>
              <div className="sm:col-span-3">
                <label className="label">Vehicle / Transport Type</label>
                <input className="input" placeholder="2019 Toyota Camry / Rideshare / Bicycle" required
                  value={form.vehicle}
                  onChange={(e) => setForm({ ...form, vehicle: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Motivation */}
          <div>
            <label className="label">Why do you want to be a SafeConnect courier?</label>
            <textarea className="input min-h-[100px] resize-y"
              placeholder="Tell us briefly why you'd like to join and any relevant experience…"
              required
              value={form.motivation}
              onChange={(e) => setForm({ ...form, motivation: e.target.value })} />
          </div>

          {/* Consent */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <input
              id="consent"
              type="checkbox"
              checked={form.consent}
              onChange={(e) => setForm({ ...form, consent: e.target.checked })}
              className="mt-1 w-4 h-4 accent-safe-700 shrink-0"
            />
            <label htmlFor="consent" className="text-sm text-amber-800 cursor-pointer leading-relaxed">
              I consent to a background check as part of the SafeConnect courier screening process.
              I certify that the information above is accurate to the best of my knowledge.
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting || !form.consent}
            className="btn-primary w-full text-base py-3"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Submitting application…
              </span>
            ) : (
              "Submit Application"
            )}
          </button>

          <p className="text-xs text-center text-safe-400">
            Already approved?{" "}
            <Link href="/login" className="underline text-safe-600 hover:text-safe-900">
              Sign in to your courier account →
            </Link>
          </p>
        </form>
      </section>
    </div>
  )
}
