export type EncryptedPayload = {
  cipherText: string
  iv: string
  salt: string
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bytesToBase64(bytes: Uint8Array) {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBytes(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function deriveKey(passcode: string, saltBase64: string) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passcode),
    "PBKDF2",
    false,
    ["deriveKey"]
  )

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToBytes(saltBase64),
      iterations: 210000,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function encryptJson(
  value: unknown,
  passcode: string,
  existingSalt?: string
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const salt = existingSalt || bytesToBase64(crypto.getRandomValues(new Uint8Array(16)))
  const key = await deriveKey(passcode, salt)

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(value))
  )

  return {
    cipherText: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
    salt,
  }
}

export async function decryptJson<T>(
  cipherText: string,
  passcode: string,
  ivBase64: string,
  saltBase64: string
): Promise<T> {
  const key = await deriveKey(passcode, saltBase64)
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(ivBase64),
    },
    key,
    base64ToBytes(cipherText)
  )

  return JSON.parse(decoder.decode(new Uint8Array(decrypted))) as T
}
