/** RFC 4122 v4 UUID using Web Crypto (no Math.random — Sonar-safe). */

/** @internal Exported for unit tests; use {@link safeUUID} in application code. */
export function uuidV4FromBytes(bytes: Uint8Array): string {
    if (bytes.length < 16) {
        throw new Error("uuidV4FromBytes requires 16 bytes");
    }
    const b = bytes;
    b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
    b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
    const hex = Array.from(b, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * UUID for authoring ids (transitions, etc.). Prefers `crypto.randomUUID`, else
 * `crypto.getRandomValues` (v4 layout). Throws if crypto is unavailable.
 */
export function safeUUID(): string {
    const crypto = globalThis.crypto;
    if (crypto && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    if (crypto && typeof crypto.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return uuidV4FromBytes(bytes);
    }
    throw new Error("safeUUID requires Web Crypto (randomUUID or getRandomValues).");
}
