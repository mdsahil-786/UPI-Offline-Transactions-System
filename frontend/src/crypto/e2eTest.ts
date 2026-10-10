import { api } from '../api/client';
import { getAccounts } from '../api/accounts';
import { registerDevice } from '../api/devices';
import { flushBridges, injectPacket, resetMesh, runGossip } from '../api/mesh';
import type { IngestResult, MeshPacket } from '../api/types';
import { exportPublicKeySpki, generateDevice } from './deviceKeys';
import type { StoredDevice } from './deviceKeys';
import { buildPacket } from './packetBuilder';
import type { PaymentRequest } from './packetBuilder';

interface Check {
    name: string;
    expected: string;
    actual: string;
    ok: boolean;
}

const rows: Check[] = [];

const ingest = (packet: MeshPacket) =>
    api.post<IngestResult>('/api/bridge/ingest', packet, {
        'X-Bridge-Node-Id': 'e2e-test',
        'X-Hop-Count': '1',
    });

function record(name: string, expected: string, r: IngestResult) {
    const actual = r.reason ? `${r.outcome}:${r.reason}` : r.outcome;
    rows.push({ name, expected, actual, ok: actual === expected });
}

/** A throwaway keypair that is NOT stored and NOT registered: plays the attacker. */
async function ephemeralDevice(vpa: string): Promise<StoredDevice> {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, [
        'sign',
        'verify',
    ]);
    return {
        vpa,
        deviceId: crypto.randomUUID(),
        privateKey: pair.privateKey,
        publicKey: pair.publicKey,
        createdAt: Date.now(),
    };
}

function tamper(p: MeshPacket): MeshPacket {
    const mid = Math.floor(p.ciphertext.length / 2);
    const swapped = p.ciphertext[mid] === 'A' ? 'B' : 'A';
    return { ...p, ciphertext: p.ciphertext.slice(0, mid) + swapped + p.ciphertext.slice(mid + 1) };
}

async function balances(): Promise<Record<string, number>> {
    const accounts = await getAccounts();
    return Object.fromEntries(accounts.map((a) => [a.vpa, Number(a.balance)]));
}

async function runE2E() {
    rows.length = 0;
    await resetMesh(); // also clears the idempotency cache

    // Register this browser's key as alice's device.
    const alice = await generateDevice('alice@demo');
    await registerDevice({
        vpa: alice.vpa,
        deviceId: alice.deviceId,
        publicKey: await exportPublicKeySpki(alice.publicKey),
    });

    const pay: PaymentRequest = { receiverVpa: 'bob@demo', amount: 10, pin: '1234' };
    const before = await balances();

    // 1. Valid signed payment settles.
    const valid = await buildPacket(alice, pay);
    record('valid signed payment', 'SETTLED', await ingest(valid.packet));

    // 2. The identical packet again is a replay.
    record('replay of the same packet', 'DUPLICATE_DROPPED', await ingest(valid.packet));

    // 3. One flipped ciphertext character breaks the GCM tag.
    record(
        'tampered ciphertext',
        'INVALID:decryption_failed',
        await ingest(tamper((await buildPacket(alice, pay)).packet)),
    );

    // 4. Attacker claims to be alice but signs with their own key.
    const attacker = await ephemeralDevice('alice@demo');
    record(
        'forged signature (attacker key)',
        'INVALID:bad_signature',
        await ingest((await buildPacket(attacker, pay)).packet),
    );

    // 5. Sender with no registered device.
    const stranger = await ephemeralDevice('mallory@demo');
    record(
        'unregistered sender',
        'INVALID:unknown_device',
        await ingest((await buildPacket(stranger, pay)).packet),
    );

    // 6. Validly signed, but signedAt is 25 hours old (limit is 24h).
    record(
        'expired timestamp',
        'INVALID:stale_packet',
        await ingest(
            (await buildPacket(alice, { ...pay, overrides: { signedAt: Date.now() - 25 * 3600 * 1000 } }))
                .packet,
        ),
    );

    // 7. Validly signed, but dated one hour in the future.
    record(
        'future-dated timestamp',
        'INVALID:future_dated',
        await ingest(
            (await buildPacket(alice, { ...pay, overrides: { signedAt: Date.now() + 3600 * 1000 } }))
                .packet,
        ),
    );

    // 8. Valid signature but more money than alice has: rejected, not settled.
    record(
        'overdraw (insufficient funds)',
        'REJECTED:insufficient_balance',
        await ingest((await buildPacket(alice, { ...pay, amount: 999999 })).packet),
    );

    // 9. Full mesh path: inject at an offline phone, gossip, bridge uploads.
    const viaMesh = await buildPacket(alice, pay);
    await injectPacket('phone-alice', viaMesh.packet);
    await runGossip();
    const flush = await flushBridges();
    const item = flush.results[0];
    rows.push({
        name: 'inject, gossip, flush via mesh',
        expected: 'SETTLED (1 upload)',
        actual: item ? `${item.outcome} (${flush.uploadsAttempted} upload)` : 'no uploads',
        ok: flush.uploadsAttempted === 1 && item?.outcome === 'SETTLED',
    });

    // 10. Two settlements of 10 each, nothing else moved money.
    const after = await balances();
    const aliceDelta = after['alice@demo'] - before['alice@demo'];
    const bobDelta = after['bob@demo'] - before['bob@demo'];
    rows.push({
        name: 'balances moved exactly twice',
        expected: 'alice -20, bob +20',
        actual: `alice ${aliceDelta}, bob +${bobDelta}`,
        ok: aliceDelta === -20 && bobDelta === 20,
    });

    console.table(rows);
    const failed = rows.filter((r) => !r.ok).length;
    console.log(failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`);
    return failed === 0;
}

// Run from the browser console: await e2e()
(window as unknown as Record<string, unknown>).e2e = runE2E;