import Link from "next/link"

export default function Footer() {
  return (
    <footer className="bg-safe-950 text-safe-300 mt-16">
      {/* Emergency banner */}
      <div className="bg-red-700 text-white text-center py-2.5 px-4">
        <p className="text-sm font-medium">
          If you are in immediate danger, call{" "}
          <a href="tel:911" className="font-bold underline decoration-red-300 hover:text-red-100">
            911
          </a>{" "}
          &nbsp;|&nbsp; National DV Hotline:{" "}
          <a href="tel:18007997233" className="font-bold underline decoration-red-300 hover:text-red-100">
            1-800-799-7233
          </a>
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">

        {/* Brand column */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-md bg-warm-400 text-safe-900 font-black text-xs">SC</span>
            <span className="font-bold text-white text-base">Safe<span className="text-warm-400">Connect</span></span>
          </div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-safe-500">About SafeConnect</h4>
          <p className="text-sm leading-relaxed text-safe-400">
            A secure courier and neutral exchange platform providing protection for individuals,
            agencies, and businesses.
          </p>
        </div>

        {/* Main */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-safe-500">Main</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/request"          className="hover:text-white transition-colors">Request a Courier Exchange</Link></li>
            <li><Link href="/courier/onboard"  className="hover:text-white transition-colors">Courier Onboarding Portal</Link></li>
            <li><Link href="/safety-plan"      className="hover:text-white transition-colors">Safety Plan Vault</Link></li>
            <li><Link href="/signup"           className="hover:text-white transition-colors">Create a Secure Account</Link></li>
          </ul>

          <div className="pt-2">
            <h5 className="text-[11px] font-semibold uppercase tracking-widest text-safe-500">Expungement Support</h5>
            <ul className="mt-2 space-y-1 text-xs text-safe-400">
              <li>Mugshot removal</li>
              <li>Record clearing eligibility review</li>
              <li>Filing assistance</li>
              <li>Confidential processing</li>
            </ul>
          </div>
        </div>

        {/* Resources */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-safe-500">Resources</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/legal-aid" className="hover:text-white transition-colors">
                Legal Aid Consultation Portal (In Person or Online)
              </Link>
            </li>
            <li>
              <Link href="/schedule" className="hover:text-white transition-colors">
                Scheduling System
              </Link>
            </li>
            <li>
              <Link href="/directory" className="hover:text-white transition-colors">
                Courthouse, Government Agencies &amp; Probation Directory
              </Link>
            </li>
            <li>
              <a href="tel:211" className="hover:text-white transition-colors">
                National Directory Line: 211
              </a>
            </li>
            <li>
              <Link href="/schedule" className="hover:text-white transition-colors">
                Book an Appointment with a Legal Attorney
              </Link>
            </li>
            <li>
              <Link href="/expungement" className="hover:text-white transition-colors">
                Expungement Support
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-safe-900 max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="text-xs text-safe-600">
          © {new Date().getFullYear()} SafeConnect. All rights reserved. All interactions are confidential.
        </p>
        <p className="text-xs text-safe-700">
          Built with care for survivors.
        </p>
      </div>

      <div className="border-t border-safe-900/60 py-2 text-center">
        <p className="text-[10px] tracking-wide text-safe-700">
          SafeConnect is powered by Armstrong Pack Company.
        </p>
        <p className="text-[10px] tracking-wide text-safe-700">
          Twilio Contact: <a href="tel:+13074540044" className="underline hover:text-safe-500">+13074540044</a>
        </p>
      </div>
    </footer>
  )
}

