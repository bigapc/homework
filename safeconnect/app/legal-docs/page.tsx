"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { supabase } from "@/lib/supabase"
import { getCurrentUser } from "@/lib/auth"

type LegalDocument = {
  id: string
  file_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  category: "protection_order" | "court_filing" | "evidence" | "id_document" | "other"
  created_at: string
}

function LegalDocsContent() {
  const [rows, setRows] = useState<LegalDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState<LegalDocument["category"]>("other")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const loadDocs = useCallback(async () => {
    setLoading(true)
    setError("")

    const user = await getCurrentUser()

    if (!user) {
      setLoading(false)
      setError("Please sign in again.")
      return
    }

    const { data, error: fetchError } = await supabase
      .from("legal_documents")
      .select("id,file_path,file_name,mime_type,size_bytes,category,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setRows([])
      setLoading(false)
      return
    }

    setRows((data ?? []) as LegalDocument[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  const uploadDocument = async (event: React.FormEvent) => {
    event.preventDefault()
    setUploading(true)
    setError("")
    setMessage("")

    if (!file) {
      setError("Choose a file to upload.")
      setUploading(false)
      return
    }

    const user = await getCurrentUser()

    if (!user) {
      setError("Please sign in again.")
      setUploading(false)
      return
    }

    const filePath = `${user.id}/${Date.now()}-${file.name}`

    const { error: uploadError } = await supabase.storage
      .from("legal-documents")
      .upload(filePath, file, { upsert: false })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { error: rowError } = await supabase.from("legal_documents").insert({
      user_id: user.id,
      file_path: filePath,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      category,
    })

    if (rowError) {
      setError(rowError.message)
      setUploading(false)
      return
    }

    setMessage("Document uploaded securely.")
    setFile(null)
    setUploading(false)
    await loadDocs()
  }

  const createDownloadUrl = useCallback(async (path: string) => {
    const { data, error } = await supabase.storage.from("legal-documents").createSignedUrl(path, 60)

    if (error || !data?.signedUrl) {
      setError(error?.message || "Unable to create download link.")
      return
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer")
  }, [])

  const docsByCategory = useMemo(() => {
    return rows.reduce<Record<string, LegalDocument[]>>((acc, row) => {
      const key = row.category
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(row)
      return acc
    }, {})
  }, [rows])

  return (
    <div className="page-container space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">Legal Documents</p>
        <h1 className="text-3xl font-bold text-safe-900">Secure Upload Vault</h1>
        <p className="text-safe-500 text-sm mt-1">Upload court filings and evidence records with survivor-only access controls.</p>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {message && <div className="alert-success">{message}</div>}

      <form className="card space-y-4" onSubmit={uploadDocument}>
        <h2 className="text-lg font-semibold text-safe-900">Upload Document</h2>
        <div>
          <label className="label">Category</label>
          <select className="input" value={category} onChange={(event) => setCategory(event.target.value as LegalDocument["category"])}>
            <option value="protection_order">Protection Order</option>
            <option value="court_filing">Court Filing</option>
            <option value="evidence">Evidence</option>
            <option value="id_document">ID Document</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="label">File</label>
          <input
            className="input"
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />
        </div>

        <button className="btn-primary w-full" type="submit" disabled={uploading}>
          {uploading ? "Uploading..." : "Upload Securely"}
        </button>
      </form>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-safe-900">Stored Documents</h2>
        {loading ? (
          <p className="text-sm text-safe-500">Loading documents…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-safe-500">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(docsByCategory).map(([label, docs]) => (
              <div key={label} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-safe-500">{label.replace("_", " ")}</p>
                {docs.map((doc) => (
                  <div key={doc.id} className="rounded-xl border border-safe-100 bg-safe-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-safe-900">{doc.file_name}</p>
                      <p className="text-xs text-safe-500">
                        {doc.mime_type || "unknown type"} • {doc.size_bytes ? `${Math.round(doc.size_bytes / 1024)} KB` : "size unknown"} • {new Date(doc.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button className="btn-secondary text-sm" type="button" onClick={() => createDownloadUrl(doc.file_path)}>
                      Open
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function LegalDocsPage() {
  return (
    <ProtectedRoute requiredRole="survivor" loadingLabel="Checking legal document access…">
      <LegalDocsContent />
    </ProtectedRoute>
  )
}
