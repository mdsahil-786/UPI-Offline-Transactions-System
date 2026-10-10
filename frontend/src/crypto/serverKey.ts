import { api } from '../api/client';
import type { ServerKeyInfo } from '../api/types';
import { base64ToBytes } from './encoding';

let cached: Promise<CryptoKey> | null = null;

/**
 * Fetch the server's public key and import it for RSA-OAEP with SHA-256.
 *
 * The backend sends X.509 SubjectPublicKeyInfo (Java's getEncoded()), which is
 * exactly what Web Crypto's 'spki' import format expects.
 *
 * Cached for the page's lifetime. The server regenerates its keypair on every
 * restart, so call resetServerKeyCache() if you restart Spring Boot while the
 * page is open (or just refresh the page).
 */
export function getServerPublicKey(): Promise<CryptoKey> {
    if (!cached) {
        cached = loadServerKey().catch((e) => {
            cached = null; // don't cache failures
            throw e;
        });
    }
    return cached;
}

export function resetServerKeyCache(): void {
    cached = null;
}

async function loadServerKey(): Promise<CryptoKey> {
    const info = await api.get<ServerKeyInfo>('/api/server-key');
    const spki = base64ToBytes(info.publicKey);
    return crypto.subtle.importKey(
        'spki',
        spki as unknown as BufferSource,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false, // public key, nothing secret to protect
        ['encrypt'],
    );
}