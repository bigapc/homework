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
          <p className="text-sm leading-relaxed text-safe-400">
            Confidential property exchange courier services — dignity and safety, first.
          </p>
        </div>

        {/* Services */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-safe-500">Services</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/request"          className="hover:text-white transition-colors">Request a Courier</Link></li>
            <li><Link href="/courier/onboard"  className="hover:text-white transition-colors">Become a Courier</Link></li>
            <li><Link href="/safety-plan"      className="hover:text-white transition-colors">Safety Plan Vault</Link></li>
            <li><Link href="/signup"           className="hover:text-white transition-colors">Create an Account</Link></li>
          </ul>
        </div>

        {/* Resources */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-safe-500">Resources</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <a
                href="https://www.thehotline.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                National DV Hotline
              </a>
            </li>
            <li>
              <a
                href="https://www.loveisrespect.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Love Is Respect
              </a>
            </li>
            <li>
              <a
                href="https://nnedv.org"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                NNEDV Network
              </a>
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
    </footer>
  )
}

