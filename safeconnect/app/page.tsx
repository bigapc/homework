import Link from "next/link"

export default function Home() {
  return (
    <div className="space-y-0">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-safe-900 text-white">
        {/* Subtle radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #e4b05a 0%, transparent 70%)" }}
        />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 animate-slide-up">
            <div className="inline-flex items-center gap-2 bg-safe-800 border border-safe-700 rounded-full px-4 py-1.5 text-xs font-semibold text-warm-400 tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-warm-400 animate-pulse-soft" />
              Confidential &amp; Secure
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">
              Safe property exchange,{" "}
              <span className="text-warm-400">without confrontation.</span>
            </h1>

            <p className="text-lg text-safe-200 leading-relaxed max-w-lg">
              SafeConnect dispatches trusted neutral couriers to retrieve or return
              belongings on your behalf — so you stay protected and never have to
              face your abuser alone.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/signup" className="btn-accent text-base px-7 py-3">
                Get Started — It&apos;s Free
              </Link>
              <Link href="#how-it-works" className="btn-secondary border-safe-600 text-white hover:bg-safe-800 text-base px-7 py-3">
                How It Works
              </Link>
            </div>

            <div className="flex flex-wrap gap-6 pt-4 text-xs text-safe-400 font-medium">
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> 100% confidential
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> GPS-verified couriers
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span> Chain-of-custody records
              </span>
            </div>
          </div>

          {/* Illustration card */}
          <div className="hidden lg:flex justify-center">
            <div className="relative w-80 h-80">
              <div className="absolute inset-0 rounded-3xl bg-safe-800 border border-safe-700 shadow-card-lg flex flex-col items-center justify-center p-8 gap-4">
                <div className="w-20 h-20 rounded-2xl bg-warm-400/20 border border-warm-400/40 flex items-center justify-center">
                  <span className="text-4xl">🛡️</span>
                </div>
                <p className="text-center text-sm text-safe-200 font-medium">
                  Trusted courier dispatched.<br />Belongings retrieved safely.
                </p>
                <div className="w-full space-y-2">
                  {["Package documented", "Route GPS-tracked", "Delivered securely"].map((step) => (
                    <div key={step} className="flex items-center gap-2 text-xs text-safe-300">
                      <span className="text-emerald-400 text-sm">✓</span>
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────── */}
      <section className="bg-warm-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-3 gap-4 text-center">
          {[
            { value: "500+",      label: "Survivors Helped" },
            { value: "99.8%",     label: "Safe Deliveries" },
            { value: "24/7",      label: "Support Available" },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-2xl font-extrabold text-safe-900">{value}</p>
              <p className="text-xs font-medium text-safe-800 mt-0.5 hidden sm:block">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────── */}
      <section id="how-it-works" className="section-container">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-safe-900">How It Works</h2>
          <p className="text-safe-500 mt-2 max-w-xl mx-auto">
            Three simple steps to safely recover your belongings.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              icon: "📝",
              title: "Submit a Request",
              desc: "Tell us what needs to be retrieved or returned. All information is encrypted and confidential.",
            },
            {
              step: "02",
              icon: "🚚",
              title: "Courier Dispatched",
              desc: "A verified neutral courier is assigned and dispatched. You can track them live via GPS.",
            },
            {
              step: "03",
              icon: "📦",
              title: "Safe Delivery",
              desc: "Your items are delivered with full chain-of-custody records. No confrontation required.",
            },
          ].map(({ step, icon, title, desc }) => (
            <div key={step} className="card flex flex-col items-start gap-4 hover:shadow-card-lg transition-shadow duration-200">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-safe-400 tracking-widest">{step}</span>
                <span className="text-2xl">{icon}</span>
              </div>
              <h3 className="text-lg font-bold text-safe-900">{title}</h3>
              <p className="text-sm text-safe-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section className="bg-safe-50 border-y border-safe-100">
        <div className="section-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-safe-900">Built for Survivors</h2>
            <p className="text-safe-500 mt-2">Every feature designed with your safety in mind.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: "🔒", title: "End-to-End Private",    desc: "Your data is never shared without your explicit consent." },
              { icon: "📍", title: "Live GPS Tracking",     desc: "Watch your courier travel in real time on a live map." },
              { icon: "📜", title: "Court-Ready Records",   desc: "Every exchange is logged with timestamps and documentation." },
              { icon: "🛡️", title: "Encrypted Safety Plan", desc: "Store sensitive notes and evidence behind a private passcode vault." },
              { icon: "🔗", title: "One-Time Trusted Share", desc: "Share your safety log securely with a trusted person — accessible once." },
              { icon: "👤", title: "No Contact Required",   desc: "You never need to face your abuser. We handle it all." },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl border border-safe-100 p-5 flex gap-4 shadow-card hover:shadow-card-lg transition-shadow">
                <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
                <div>
                  <h4 className="font-semibold text-safe-900 text-sm">{title}</h4>
                  <p className="text-xs text-safe-500 mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Safety Plan callout ──────────────────────────────────── */}
      <section className="section-container">
        <div className="relative overflow-hidden rounded-3xl bg-safe-900 text-white p-8 sm:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 -left-16 w-72 h-72 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #e4b05a 0%, transparent 70%)" }}
          />
          <div className="relative max-w-2xl space-y-4">
            <p className="text-warm-400 text-xs font-semibold uppercase tracking-widest">For Survivors</p>
            <h2 className="text-3xl font-bold">Your Safety Plan Vault</h2>
            <p className="text-safe-200 leading-relaxed">
              Document incidents, store evidence, record violations, and keep
              court notes — all encrypted behind a passcode only you know.
              You can generate a one-time code to share your log with your
              lawyer or a trusted contact.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/signup" className="btn-accent">
                Create Your Vault
              </Link>
              <Link href="/login" className="btn-ghost text-white hover:bg-safe-800">
                Sign In to Vault →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="bg-warm-400">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14 text-center space-y-6">
          <h2 className="text-3xl font-extrabold text-safe-900">
            You deserve to feel safe.
          </h2>
          <p className="text-safe-800 text-lg">
            Let us handle the exchange. You focus on your next chapter.
          </p>
          <Link href="/signup" className="btn-primary text-base px-10 py-3.5 bg-safe-900 hover:bg-safe-800">
            Start for Free
          </Link>
          <p className="text-xs text-safe-700 mt-2">No credit card required. Always confidential.</p>
        </div>
      </section>

    </div>
  )
}

