import { afterEach, describe, expect, it, vi } from "vitest";
import { safeUUID, uuidV4FromBytes } from "../src/randomId.js";

const originalCrypto = globalThis.crypto;

afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "crypto", {
        value: originalCrypto,
        configurable: true,
        writable: true,
    });
});

describe("safeUUID", () => {
    it("uses crypto.randomUUID when available", () => {
        Object.defineProperty(globalThis, "crypto", {
            value: { randomUUID: () => "uuid-from-crypto" },
            configurable: true,
            writable: true,
        });

        expect(safeUUID()).toBe("uuid-from-crypto");
    });

    it("builds RFC 4122 v4 UUID from getRandomValues when randomUUID is unavailable", () => {
        const bytes = Uint8Array.from({ length: 16 }, (_, i) => i);
        Object.defineProperty(globalThis, "crypto", {
            value: {
                getRandomValues(arr: Uint8Array) {
                    arr.set(bytes);
                    return arr;
                },
            },
            configurable: true,
            writable: true,
        });

        expect(safeUUID()).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
    });

    it("rejects buffers shorter than 16 bytes", () => {
        expect(() => uuidV4FromBytes(new Uint8Array(15))).toThrow(
            "uuidV4FromBytes requires 16 bytes"
        );
    });

    it("uses ?? 0 when version/variant byte slots are undefined (sparse buffer)", () => {
        const bytes = Array.from({ length: 16 }, (_, i) =>
            i === 6 || i === 8 ? undefined : 0x01,
        ) as unknown as Uint8Array;

        expect(uuidV4FromBytes(bytes)).toBe(
            "01010101-0101-4001-8001-010101010101",
        );
    });

    it("sets version and variant bits when byte slots are zero (noUncheckedIndexedAccess-safe)", () => {
        Object.defineProperty(globalThis, "crypto", {
            value: {
                getRandomValues(arr: Uint8Array) {
                    arr.fill(1);
                    return arr;
                },
            },
            configurable: true,
            writable: true,
        });

        expect(safeUUID()).toBe("01010101-0101-4101-8101-010101010101");
    });

    it("throws when Web Crypto is unavailable", () => {
        Object.defineProperty(globalThis, "crypto", {
            value: undefined,
            configurable: true,
            writable: true,
        });

        expect(() => safeUUID()).toThrow(
            "safeUUID requires Web Crypto (randomUUID or getRandomValues)."
        );
    });
});
