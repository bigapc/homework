"use client"

import ProtectedRoute from "@/components/ProtectedRoute"
import DispatcherBase from "@/components/DispatcherBase"
import DispatcherAlertPanel from "@/components/DispatcherAlertPanel"
import AdminOperationsSummary from "@/components/AdminOperationsSummary"

export default function DispatcherPage() {
  return (
    <ProtectedRoute requiredRole="admin" loadingLabel="Connecting to SafeConnect Dispatcher Base…">
      <div className="page-container space-y-6">
        <DispatcherAlertPanel />
        <AdminOperationsSummary />
        <DispatcherBase
          title="SafeConnect Dispatcher Base"
          productName="APC-SafeConnect Courier Base"
          subtitle="Secure, admin-only dispatch command center for staff and customer safety."
        />
      </div>
    </ProtectedRoute>
  )
}
