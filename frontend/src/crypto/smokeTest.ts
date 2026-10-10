import { api } from '../api/client';
import type { IngestResult, MeshPacket } from '../api/types';
import { utf8Encode, bytesToBase64 } from './encoding';
import { getServerPublicKey } from './serverKey';
import { hybridEncrypt } from './hybridEncrypt';


import { generateDevice, exportPublicKeySpki } from './deviceKeys';
import { buildPacket } from './packetBuilder';
import { verifyBytes } from './sign';

async function sendFromBrowser(tamper: boolean): Promise<IngestResult> {
    const payload = {
        senderVpa: 'alice@demo',
        receiverVpa: 'bob@demo',
        amount: 10,
        pinHash: 'smoke-test',
        nonce: crypto.randomUUID(),
        signedAt: Date.now(),
    };

    const { base64 } = await hybridEncrypt(
        utf8Encode(JSON.stringify(payload)),
        await getServerPublicKey(),
    );

    let ciphertext = base64;
    if (tamper) {
        const mid = Math.floor(ciphertext.length / 2);
        const swapped = ciphertext[mid] === 'A' ? 'B' : 'A';
        ciphertext = ciphertext.slice(0, mid) + swapped + ciphertext.slice(mid + 1);
    }

    const packet: MeshPacket = {
        packetId: crypto.randomUUID(),
        ttl: 5,
        createdAt: Date.now(),
        ciphertext,
    };

    return api.post<IngestResult>('/api/bridge/ingest', packet, {
        'X-Bridge-Node-Id': 'browser-smoke',
        'X-Hop-Count': '1',
    });
}

// Run from the browser console: await smoke() or await smoke(true)
(window as unknown as Record<string, unknown>).smoke = async (tamper = false) => {
    const r = await sendFromBrowser(tamper);
    console.log(tamper ? 'tampered ->' : 'valid ->', r);
    return r;
};



(window as unknown as Record<string, unknown>).localCheck = async () => {
    const device = await generateDevice('alice@demo');
    const built = await buildPacket(device, { receiverVpa: 'bob@demo', amount: 10, pin: '1234' });
    const { payloadBytes, signature, hybrid } = built.inspection;

    const ok = await verifyBytes(device.publicKey, signature, payloadBytes);
    const bad = await verifyBytes(device.publicKey, signature, new Uint8Array([...payloadBytes, 1]));

    console.log('signature length (expect 64):', signature.length);
    console.log('wrapped key length (expect 256):', hybrid.wrappedKey.length);
    console.log('verifies on original bytes (expect true):', ok);
    console.log('verifies on altered bytes (expect false):', bad);
    console.log('private key extractable (expect false):', device.privateKey.extractable);
    console.log('public key SPKI:', await exportPublicKeySpki(device.publicKey));
};



(window as unknown as Record<string, unknown>).exportSigFixture = async () => {
    const device = await generateDevice('alice@demo');
    const built = await buildPacket(device, { receiverVpa: 'bob@demo', amount: 10, pin: '1234' });
    return {
        publicKeySpki: await exportPublicKeySpki(device.publicKey),
        payloadBase64: bytesToBase64(built.inspection.payloadBytes),
        signatureBase64: bytesToBase64(built.inspection.signature),
    };
};