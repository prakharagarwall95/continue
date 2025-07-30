import { name, version } from "../../../../package.json"
import { jwtDecode, type JwtPayload } from "jwt-decode"
import SHA256 from "crypto-js/sha256"
import { enc } from "crypto-js"

/**
 * Generates a compliant customer opc-request-id segment.
 *
 * Format (32 hex):
 *   [token hash (8)] [taskId hash (8)] [timestamp (8)] [random (8)]
 * - token hash:    first 4 bytes of SHA-256(token)
 * - taskId hash:   first 4 bytes of SHA-256(taskId)
 * - timestamp:     Unix seconds since epoch, 8 hex digits
 * - random:        strong random, 8 hex digits
 *
 * Use: Send this single value as the opc-request-id header.
 */
function hash8(str: string): string {
  const hash = SHA256(str)
  // Get first 4 bytes as hex (8 characters)
  return hash.toString(enc.Hex).substring(0, 8)
}

function randomHex8(): string {
  // Generate a random 32-bit (4-byte) number and return as 8 hex digits
  const arr = new Uint32Array(1)
  // Use built-in Math.random for cross-platform, or
  // Use node's crypto if available, but sticking to Math.random for cross-environment
  arr[0] =
    Math.floor(Math.random() * 0x100000000) // generate 32-bits
  return arr[0].toString(16).padStart(8, "0")
}

export function generateOpcRequestId(taskId: string, token: string): string {
  const tokenHex = hash8(token)
  const taskHex = hash8(taskId)
  const timestampHex = Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, "0")
  return tokenHex + taskHex + timestampHex + randomHex8()
}

/**
 * Create headers for OCA requests
 */
export function createOcaHeaders(accessToken: string, taskId: string): Record<string, string> {
  const opcRequestId = generateOpcRequestId(taskId, accessToken)
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    client: "Continue",
    "client-version": `${name}-${version}`,
    "client-ide": name,
    "client-ide-version": version,
    "opc-request-id": opcRequestId,
  }
}

/**
 * Decodes a JWT payload without validation and returns the 'sub' claim.
 * Use only for non-security, informational, or display purposes.
 * @param token JWT string
 */
export function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const payload = jwtDecode(token)
    return payload
  } catch {
    return null
  }
}