"use client"

import { useState } from "react"
import Link from "next/link"

type Category = "courthouse" | "government" | "probation" | "all"

const DIRECTORY = [
  // Courthouses
  { id: 1, category: "courthouse", name: "Circuit Court — Family Division", address: "125 W 2nd St, Casper, WY 82601", phone: "(307) 235-9280", hours: "Mon–Fri 8am–5pm", desc: "Protection orders, custody hearings, divorce proceedings." },
  { id: 2, category: "courthouse", name: "District Court Clerk's Office", address: "316 W Park St, Casper, WY 82601", phone: "(307) 235-9227", hours: "Mon–Fri 8am–5pm", desc: "Criminal records, court filings, case status inquiries." },
  { id: 3, category: "courthouse", name: "Municipal Court", address: "200 N David St, Casper, WY 82601", phone: "(307) 235-8400", hours: "Mon–Fri 8am–4:30pm", desc: "Municipal violations, minor offenses, local ordinance hearings." },
  // Government Agencies
  { id: 4, category: "government", name: "Wyoming Department of Family Services", address: "851 Werner Ct, Casper, WY 82601", phone: "(307) 235-9280", hours: "Mon–Fri 8am–5pm", desc: "Child welfare, protective services, benefits assistance." },
  { id: 5, category: "government", name: "Wyoming Legal Aid", address: "143 S Durbin St #201, Casper, WY 82601", phone: "(307) 235-6954", hours: "Mon–Fri 9am–4pm", desc: "Free civil legal services for low-income individuals." },
  { id: 6, category: "government", name: "Social Security Administration", address: "150 E B St #1000, Casper, WY 82601", phone: "1-800-772-1213", hours: "Mon–Fri 9am–4pm", desc: "Disability claims, SSI, retirement, and survivor benefits." },
  { id: 7, category: "government", name: "Wyoming Workforce Services", address: "851 Werner Ct Ste 100, Casper, WY 82601", phone: "(307) 473-3840", hours: "Mon–Fri 8am–5pm", desc: "Employment assistance, job training, unemployment benefits." },
  // Probation & Parole
  { id: 8, category: "probation", name: "Wyoming DOC — Probation & Parole", address: "1700 E College Dr, Cheyenne, WY 82007", phone: "(307) 777-7208", hours: "Mon–Fri 8am–5pm", desc: "State probation and parole supervision, officer check-ins." },
  { id: 9, category: "probation", name: "Natrona County Adult Probation", address: "200 N Center St, Casper, WY 82601", phone: "(307) 235-9302", hours: "Mon–Fri 8am–5pm", desc: "Local probation supervision and case management services." },
  { id: 10, category: "probation", name: "Community Supervision Center", address: "322 E 2nd St, Casper, WY 82601", phone: "(307) 237-9900", hours: "Mon–Fri 7am–6pm", desc: "Check-in reporting, UA testing, community service coordination." },
]

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "all", label: "All Listings" },
  { value: "courthouse", label: "Courthouses" },
  { value: "government", label: "Government Agencies" },
  { value: "probation", label: "Probation & Parole" },
]

const CATEGORY_ICONS: Record<string, string> = {
  courthouse: "🏛️",
  government: "🏢",
  probation: "📋",
}

export default function DirectoryPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("all")
  const [search, setSearch] = useState("")

  const filtered = DIRECTORY.filter((entry) => {
    const matchesCategory = activeCategory === "all" || entry.category === activeCategory
    const matchesSearch =
      search.trim() === "" ||
      entry.name.toLowerCase().includes(search.toLowerCase()) ||
      entry.desc.toLowerCase().includes(search.toLowerCase()) ||
      entry.address.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="page-container">
      {/* Hero */}
      <div className="bg-safe-950 text-white py-14 px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="inline-block bg-warm-400/20 text-warm-400 text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full">
            Resource Directory
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold">Courthouse, Government &amp; Probation Directory</h1>
          <p className="text-safe-300 text-sm leading-relaxed">
            Find courthouses, local and state government agencies, and probation &amp; parole
            offices — all in one place.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, type, or address…"
            className="input-field flex-1"
          />
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium
                  ${activeCategory === cat.value
                    ? "bg-warm-400 text-safe-900 border-warm-400"
                    : "border-safe-700 text-safe-400 hover:border-warm-400 hover:text-warm-400"}`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Listings */}
        {filtered.length === 0 ? (
          <div className="card text-center text-safe-500 py-10">No results found. Try adjusting your search.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {filtered.map((entry) => (
              <div key={entry.id} className="card space-y-2 hover:border-safe-700 transition-colors">
                <div className="flex items-start gap-2">
                  <span className="text-lg mt-0.5">{CATEGORY_ICONS[entry.category]}</span>
                  <div>
                    <p className="font-semibold text-safe-100 text-sm">{entry.name}</p>
                    <p className="text-[11px] text-warm-400 uppercase tracking-wide font-medium mt-0.5 capitalize">{entry.category.replace("-", " ")}</p>
                  </div>
                </div>
                <p className="text-xs text-safe-400">{entry.desc}</p>
                <div className="pt-1 space-y-1 text-xs text-safe-500">
                  <p>📍 {entry.address}</p>
                  <p>
                    📞{" "}
                    <a href={`tel:${entry.phone.replace(/\D/g, "")}`} className="hover:text-warm-400 underline">
                      {entry.phone}
                    </a>
                  </p>
                  <p>🕐 {entry.hours}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Call to action */}
        <div className="card bg-safe-900/50 border border-safe-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-safe-100">Need help navigating these offices?</p>
            <p className="text-xs text-safe-400">Schedule a session with a legal consultant who can walk you through the process.</p>
          </div>
          <Link href="/legal-aid" className="btn-secondary whitespace-nowrap">Get Legal Aid</Link>
        </div>

        {/* National line */}
        <p className="text-center text-xs text-safe-500">
          National Directory / Information Line:{" "}
          <a href="tel:211" className="text-warm-400 hover:underline">Call 211</a>
          {" · "}
          <Link href="/schedule" className="text-warm-400 hover:underline">Book an Appointment →</Link>
        </p>

      </div>
    </div>
  )
}
