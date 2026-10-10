import type { MeshPacket } from '../api/types';
import { bytesToBase64, bytesToHex, utf8Encode } from './encoding';
import { getServerPublicKey } from './serverKey';
import { hybridEncrypt } from './hybridEncrypt';
import type { HybridParts } from './hybridEncrypt';
import { signBytes } from './sign';
import type { StoredDevice } from './deviceKeys';

/** Same fields as the Java PaymentInstruction record. */
export interface PaymentPayload {
    senderVpa: string;
    receiverVpa: string;
    amount: number;
    pinHash: string;
    nonce: string;
    signedAt: number; // epoch millis
}

export interface PaymentRequest {
    receiverVpa: string;
    amount: number;
    pin: string;
    ttl?: number;
    /** Security Lab hook: force specific field values (e.g. an old signedAt). */
    overrides?: Partial<PaymentPayload>;
}

/** Everything PacketInspector needs to display each layer. */
export interface PacketInspection {
    payloadJson: string;
    payloadBytes: Uint8Array;
    signature: Uint8Array; // r||s
    envelopeJson: string;
    hybrid: HybridParts;
}

export interface BuiltPacket {
    packet: MeshPacket;
    payload: PaymentPayload;
    inspection: PacketInspection;
}

async function sha256Hex(text: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', utf8Encode(text) as unknown as BufferSource);
    return bytesToHex(new Uint8Array(digest));
}

/**
 * Build a signed, encrypted MeshPacket entirely in the browser.
 *
 * Layers, inside out:
 *   1. payload bytes = UTF-8 JSON of PaymentPayload (serialized exactly once)
 *   2. signature     = ECDSA(device private key, payload bytes)
 *   3. envelope      = { payload: base64(payload bytes), sig: base64(signature) }
 *   4. ciphertext    = hybridEncrypt(envelope) with the server's public key
 *
 * The server must verify the signature over the decoded payload bytes, never
 * over a re-serialized object, because JS and Jackson format JSON differently.
 */
export async function buildPacket(
    device: StoredDevice,
    req: PaymentRequest,
): Promise<BuiltPacket> {
    const payload: PaymentPayload = {
        senderVpa: device.vpa,
        receiverVpa: req.receiverVpa,
        amount: req.amount,
        pinHash: await sha256Hex(req.pin),
        nonce: crypto.randomUUID(),
        signedAt: Date.now(),
        ...req.overrides,
    };

    const payloadJson = JSON.stringify(payload);
    const payloadBytes = utf8Encode(payloadJson);
    const signature = await signBytes(device.privateKey, payloadBytes);

    const envelopeJson = JSON.stringify({
        payload: bytesToBase64(payloadBytes),
        sig: bytesToBase64(signature),
    });

    const { base64, parts } = await hybridEncrypt(
        utf8Encode(envelopeJson),
        await getServerPublicKey(),
    );

    return {
        packet: {
            packetId: crypto.randomUUID(),
            ttl: req.ttl ?? 5,
            createdAt: Date.now(),
            ciphertext: base64,
        },
        payload,
        inspection: { payloadJson, payloadBytes, signature, envelopeJson, hybrid: parts },
    };
}