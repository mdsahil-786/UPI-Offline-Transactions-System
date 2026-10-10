import { asBufferSource, bytesToBase64, concatBytes } from './encoding';

const RSA_BLOCK_BYTES = 256; // 2048-bit RSA output size
const IV_BYTES = 12;

export interface HybridParts {
    wrappedKey: Uint8Array; // 256 bytes, RSA-OAEP(AES key)
    iv: Uint8Array; // 12 bytes
    ciphertextAndTag: Uint8Array; // AES-GCM output = ciphertext || 16-byte tag
}

export interface HybridResult {
    base64: string; // goes into MeshPacket.ciphertext
    parts: HybridParts; // kept so PacketInspector can show each section
}

/**
 * Mirror of HybridCryptoService.encrypt() on the Java side.
 *
 * Wire format:
 *   [ 256 bytes RSA-OAEP(AES key) ][ 12 bytes IV ][ ciphertext + 16-byte GCM tag ]
 *
 * Web Crypto's AES-GCM already returns ciphertext||tag, which is what Java's
 * decrypt() expects, so no re-packing is needed.
 */
export async function hybridEncrypt(
    plaintext: Uint8Array,
    serverKey: CryptoKey,
): Promise<HybridResult> {
    // 1. Fresh AES-256 key for this packet only.
    const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
    ]);

    // 2. AES-GCM encrypt the payload.
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ciphertextAndTag = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asBufferSource(iv) }, aesKey, asBufferSource(plaintext)),
    );

    // 3. RSA-OAEP wrap just the AES key.
    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
    const wrappedKey = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, serverKey, rawAesKey),
    );

    if (wrappedKey.length !== RSA_BLOCK_BYTES) {
        throw new Error(
            `Expected a ${RSA_BLOCK_BYTES}-byte RSA block but got ${wrappedKey.length}. ` +
            `The server key is not RSA-2048, so Java's decrypt() will misparse the packet.`,
        );
    }

    // 4. Pack in the exact order Java unpacks.
    const packed = concatBytes(wrappedKey, iv, ciphertextAndTag);
    return { base64: bytesToBase64(packed), parts: { wrappedKey, iv, ciphertextAndTag } };
}