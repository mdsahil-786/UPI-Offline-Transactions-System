/** Base64 and byte helpers shared by everything in crypto/. */

const CHUNK = 0x8000; // 32k: stays far below the argument-count limit of fromCharCode

export function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((n, p) => n + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of parts) {
        out.set(p, offset);
        offset += p.length;
    }
    return out;
}

export const utf8Encode = (s: string): Uint8Array => new TextEncoder().encode(s);
export const utf8Decode = (b: Uint8Array): string => new TextDecoder().decode(b);

export function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Newer TypeScript versions (5.7+) type Uint8Array as Uint8Array<ArrayBufferLike>,
 * which Web Crypto's BufferSource parameter rejects. This cast keeps the code
 * compiling on every TS 5.x version without changing runtime behaviour.
 */
export const asBufferSource = (b: Uint8Array): BufferSource => b as unknown as BufferSource;