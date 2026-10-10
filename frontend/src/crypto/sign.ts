import { asBufferSource } from './encoding';

const ECDSA = { name: 'ECDSA', hash: 'SHA-256' } as const;

/**
 * Sign raw bytes. Web Crypto returns the signature in IEEE P1363 form,
 * r||s, 64 bytes for P-256. Java defaults to DER, so the server must
 * verify with "SHA256withECDSAinP1363Format" (added in part C).
 */
export async function signBytes(privateKey: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
    const sig = await crypto.subtle.sign(ECDSA, privateKey, asBufferSource(data));
    return new Uint8Array(sig);
}

/** Local verification, used by the console self-check and later by the Security Lab. */
export function verifyBytes(
    publicKey: CryptoKey,
    signature: Uint8Array,
    data: Uint8Array,
): Promise<boolean> {
    return crypto.subtle.verify(ECDSA, publicKey, asBufferSource(signature), asBufferSource(data));
}