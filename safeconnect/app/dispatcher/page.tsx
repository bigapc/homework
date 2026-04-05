"use client"

import ProtectedRoute from "@/components/ProtectedRoute"
import DispatcherBase from "@/components/DispatcherBase"

export default function DispatcherPage() {
  return (
    <ProtectedRoute requiredRole="admin" loadingLabel="Connecting to SafeConnect Dispatcher Base…">
      <DispatcherBase
        title="SafeConnect Dispatcher Base"
        productName="APC-SafeConnect Courier Base"
        subtitle="Secure, admin-only dispatch command center for staff and customer safety."
      />
    </ProtectedRoute>
  )
}
