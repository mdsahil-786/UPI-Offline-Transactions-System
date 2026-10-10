import { bytesToBase64 } from './encoding';

/**
 * The phone's long-lived signing identity: an ECDSA P-256 keypair.
 *
 * The private key is generated with extractable=false, so JavaScript can ask the
 * browser to sign with it but can never read its bytes, not even XSS code.
 * CryptoKey objects survive structured cloning, so they can be stored in
 * IndexedDB directly without ever being exported.
 */

const DB_NAME = 'upi-mesh-wallet';
const STORE = 'deviceKeys';

export interface StoredDevice {
    vpa: string; // primary key: one device identity per VPA in this demo
    deviceId: string;
    privateKey: CryptoKey;
    publicKey: CryptoKey;
    createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'vpa' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
    const db = await openDb();
    try {
        return await new Promise<T>((resolve, reject) => {
            const req = run(db.transaction(STORE, mode).objectStore(STORE));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    } finally {
        db.close();
    }
}

/** Create and persist a fresh keypair for this VPA, replacing any existing one. */
export async function generateDevice(vpa: string): Promise<StoredDevice> {
    const pair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false, // private key non-extractable. The public key is always exportable.
        ['sign', 'verify'],
    );
    const device: StoredDevice = {
        vpa,
        deviceId: crypto.randomUUID(),
        privateKey: pair.privateKey,
        publicKey: pair.publicKey,
        createdAt: Date.now(),
    };
    await withStore('readwrite', (s) => s.put(device));
    return device;
}

export async function loadDevice(vpa: string): Promise<StoredDevice | null> {
    const found = await withStore<StoredDevice | undefined>('readonly', (s) => s.get(vpa));
    return found ?? null;
}

export async function deleteDevice(vpa: string): Promise<void> {
    await withStore('readwrite', (s) => s.delete(vpa));
}

/** Public key as base64 X.509 SPKI. This is what gets registered with the server. */
export async function exportPublicKeySpki(publicKey: CryptoKey): Promise<string> {
    const spki = await crypto.subtle.exportKey('spki', publicKey);
    return bytesToBase64(new Uint8Array(spki));
}