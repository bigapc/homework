import "./globals.css"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { assertRequiredEnv } from "@/lib/env"

if (process.env.NODE_ENV === "production" || process.env.STRICT_ENV_VALIDATION === "1") {
  assertRequiredEnv("startup", "SafeConnect startup")
}

export const metadata = {
  title: "SafeConnect — Safe Property Exchange for Survivors",
  description: "Confidential courier services for domestic violence survivors. No confrontation. GPS-tracked. Court-ready documentation."
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
