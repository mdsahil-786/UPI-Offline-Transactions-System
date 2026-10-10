import type { ReactNode } from 'react';
import { bytesToHex, utf8Encode } from '../../crypto/encoding';
import type { BuiltPacket } from '../../crypto/packetBuilder';
import styles from './forms.module.css';

const GCM_TAG_BYTES = 16;

function preview(bytes: Uint8Array, n = 16): string {
    return bytesToHex(bytes.subarray(0, n)) + (bytes.length > n ? '…' : '');
}

function Layer({ title, size, children }: { title: string; size: string; children: ReactNode }) {
    return (
        <div className={styles.layer}>
            <div className={styles.layerHead}>
                <strong>{title}</strong>
                <span className="muted mono">{size}</span>
            </div>
            {children}
        </div>
    );
}

export function PacketInspector({ built }: { built: BuiltPacket | null }) {
    if (!built) {
        return <p className="muted">Send a payment in step 2 and its packet will be taken apart here.</p>;
    }

    const { payload, packet, inspection } = built;
    const { payloadBytes, signature, envelopeJson, hybrid } = inspection;
    const ct = hybrid.ciphertextAndTag;
    const tag = ct.subarray(ct.length - GCM_TAG_BYTES);
    const body = ct.subarray(0, ct.length - GCM_TAG_BYTES);
    const wireBytes = hybrid.wrappedKey.length + hybrid.iv.length + ct.length;

    return (
        <div>
            <p className="muted">
                Layers from the inside out. Each one wraps the one above it, and only the last is visible to
                phones carrying the packet.
            </p>

            <Layer title="1. Payment payload (plaintext)" size={`${payloadBytes.length} bytes`}>
                <pre className={styles.pre}>{JSON.stringify(payload, null, 2)}</pre>
                <p className="muted">
                    The signature covers these exact bytes (compact JSON), not a re-serialized copy. The nonce
                    makes two identical payments produce different packets.
                </p>
            </Layer>

            <Layer title="2. Signature (ECDSA P-256 over SHA-256)" size={`${signature.length} bytes = r‖s`}>
                <dl className={styles.kv}>
                    <dt>r (32 bytes)</dt>
                    <dd className="mono">{bytesToHex(signature.subarray(0, 32))}</dd>
                    <dt>s (32 bytes)</dt>
                    <dd className="mono">{bytesToHex(signature.subarray(32))}</dd>
                </dl>
            </Layer>

            <Layer title="3. Signed envelope" size={`${utf8Encode(envelopeJson).length} bytes`}>
                <pre className={styles.pre}>{JSON.stringify(JSON.parse(envelopeJson), null, 2)}</pre>
            </Layer>

            <Layer title="4. Hybrid encryption (RSA-OAEP + AES-256-GCM)" size={`${wireBytes} bytes`}>
                <dl className={styles.kv}>
                    <dt>RSA-wrapped AES key</dt>
                    <dd className="mono">
                        {hybrid.wrappedKey.length} bytes: {preview(hybrid.wrappedKey)}
                    </dd>
                    <dt>GCM IV</dt>
                    <dd className="mono">
                        {hybrid.iv.length} bytes: {bytesToHex(hybrid.iv)}
                    </dd>
                    <dt>Ciphertext</dt>
                    <dd className="mono">
                        {body.length} bytes: {preview(body)}
                    </dd>
                    <dt>GCM auth tag</dt>
                    <dd className="mono">
                        {tag.length} bytes: {bytesToHex(tag)}
                    </dd>
                </dl>
            </Layer>

            <Layer title="5. Packet on the wire" size={`${packet.ciphertext.length} base64 chars`}>
                <dl className={styles.kv}>
                    <dt>packetId</dt>
                    <dd className="mono">{packet.packetId}</dd>
                    <dt>ttl</dt>
                    <dd className="mono">{packet.ttl}</dd>
                    <dt>createdAt</dt>
                    <dd className="mono">{new Date(packet.createdAt).toLocaleString()}</dd>
                    <dt>ciphertext</dt>
                    <dd className="mono">{packet.ciphertext.slice(0, 64)}…</dd>
                </dl>
                <p className="muted">
                    Intermediate phones can read packetId, ttl and createdAt to route and de-duplicate. The
                    ciphertext is opaque to them, and flipping any bit of it makes the GCM tag fail on the server.
                </p>
            </Layer>
        </div>
    );
}