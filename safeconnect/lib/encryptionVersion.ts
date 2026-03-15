export function getClientEncryptionKeyVersion() {
  const raw = process.env.NEXT_PUBLIC_ENCRYPTION_KEY_VERSION
  const parsed = Number(raw)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }

  return Math.floor(parsed)
}
