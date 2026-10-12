import { ingestPacket } from '../../api/bridge';
import type { IngestResult, MeshPacket } from '../../api/types';
import type { StoredDevice } from '../../crypto/deviceKeys';
import { bytesToBase64, utf8Encode } from '../../crypto/encoding';
import { hybridEncrypt } from '../../crypto/hybridEncrypt';
import { buildPacket } from '../../crypto/packetBuilder';
import type { PaymentPayload, PaymentRequest } from '../../crypto/packetBuilder';
import { getServerPublicKey } from '../../crypto/serverKey';
import { closeWallet, getWallet, loadWallet } from '../../api/wallets';

export interface AttackContext {
    device: StoredDevice; // the registered sender the attacks are aimed at
    balance: number; // that sender's current balance
}

export interface StepResult {
    label: string;
    expected: string;
    actual: string;
    ok: boolean;
}

export interface Attack {
    id: string;
    title: string;
    story: string; // what the attacker does
    defence: string; // what stops them
    movesMoney: boolean;
    run: (ctx: AttackContext) => Promise<StepResult[]>;
    ownsWallet?: boolean; // true: the card sets up its own wallet. Otherwise the page closes alice's wallet first.
}

// ---- helpers --------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;
const ACCOUNTS = ['bob@demo', 'carol@demo', 'dave@demo'];

function describeOutcome(r: IngestResult): string {
    return r.reason ? `${r.outcome}:${r.reason}` : r.outcome;
}

async function send(label: string, expected: string, packet: MeshPacket): Promise<StepResult> {
    const actual = describeOutcome(await ingestPacket(packet));
    return { label, expected, actual, ok: actual === expected };
}

/** Start the wallet cards from a known state: no wallet, then one holding `amount`. */
async function freshWallet(vpa: string, amount: number): Promise<void> {
    await closeWallet(vpa);
    await loadWallet(vpa, amount);
}

/** Accounts the sender can pay (everyone except the sender). */
function others(device: StoredDevice): string[] {
    return ACCOUNTS.filter((v) => v !== device.vpa);
}

function payment(ctx: AttackContext, extra: Partial<PaymentRequest> = {}): PaymentRequest {
    return { receiverVpa: others(ctx.device)[0], amount: 10, pin: '1234', ...extra };
}

/** Change one character in the middle of the ciphertext. */
function flipOneCharacter(p: MeshPacket): MeshPacket {
    const mid = Math.floor(p.ciphertext.length / 2);
    const swapped = p.ciphertext[mid] === 'A' ? 'B' : 'A';
    return { ...p, ciphertext: p.ciphertext.slice(0, mid) + swapped + p.ciphertext.slice(mid + 1) };
}

/** A keypair that is never stored or registered: plays the attacker. */
async function throwawayDevice(vpa: string): Promise<StoredDevice> {
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

/**
 * Take a genuine signature, edit the payment it was made for, and encrypt the
 * edited version with the server's PUBLIC key (which anyone can fetch).
 */
async function splicedPacket(ctx: AttackContext): Promise<MeshPacket> {
    const built = await buildPacket(ctx.device, payment(ctx));
    const original = JSON.parse(built.inspection.payloadJson) as PaymentPayload;
    const list = others(ctx.device);
    const forged: PaymentPayload = { ...original, receiverVpa: list[list.length - 1], amount: 500 };

    const envelope = JSON.stringify({
        payload: bytesToBase64(utf8Encode(JSON.stringify(forged))),
        sig: bytesToBase64(built.inspection.signature), // signature of the ORIGINAL bytes
    });
    const { base64 } = await hybridEncrypt(utf8Encode(envelope), await getServerPublicKey());
    return { packetId: crypto.randomUUID(), ttl: 5, createdAt: Date.now(), ciphertext: base64 };
}

// ---- the attacks ----------------------------------------------------------

export const ATTACKS: Attack[] = [
    {
        id: 'replay',
        title: 'Replay a captured payment',
        movesMoney: true,
        story:
            "A stranger's phone copies Alice's packet and uploads it a second time, hoping the server pays twice.",
        defence:
            'The server remembers the SHA-256 fingerprint of every ciphertext it has accepted. The second copy is byte-for-byte identical, so it is dropped before any decryption happens.',
        run: async (ctx) => {
            const { packet } = await buildPacket(ctx.device, payment(ctx));
            return [
                await send('Legitimate delivery', 'SETTLED', packet),
                await send('Attacker uploads the captured copy', 'DUPLICATE_DROPPED', packet),
            ];
        },
    },
    {
        id: 'rewrite-id',
        title: 'Rewrite the packet ID',
        movesMoney: true,
        story:
            "A malicious phone changes the packet's visible ID so its copy looks like a brand-new packet.",
        defence:
            "The server ignores the packet ID. It fingerprints the encrypted payload, which no phone can change without breaking it, so the copy is still recognised.",
        run: async (ctx) => {
            const { packet } = await buildPacket(ctx.device, payment(ctx));
            return [
                await send('Original delivery', 'SETTLED', packet),
                await send('Same ciphertext, new packet ID', 'DUPLICATE_DROPPED', {
                    ...packet,
                    packetId: crypto.randomUUID(),
                }),
            ];
        },
    },
    {
        id: 'tamper',
        title: 'Flip one character of the ciphertext',
        movesMoney: false,
        story: 'A phone carrying the packet tries to change the amount by editing the encrypted bytes.',
        defence:
            "AES-GCM's authentication tag covers every byte. Change a single character and decryption fails, so the server never reads the payload, let alone settles it.",
        run: async (ctx) => {
            const { packet } = await buildPacket(ctx.device, payment(ctx));
            return [await send('Tampered packet', 'INVALID:decryption_failed', flipOneCharacter(packet))];
        },
    },
    {
        id: 'splice',
        title: 'Edit the payment, keep the signature',
        movesMoney: false,
        story:
            "The server's public key is public, so an attacker can encrypt anything they like. They take Alice's real signature, change the receiver and amount to ₹500 for themselves, re-encrypt, and send it.",
        defence:
            "Encryption only hides a payment; the signature proves who wrote it. Alice signed the original bytes, so her signature does not verify over the edited ones.",
        run: async (ctx) => [
            await send('Edited payment with original signature', 'INVALID:bad_signature', await splicedPacket(ctx)),
        ],
    },
    {
        id: 'forge',
        title: 'Pretend to be Alice with your own key',
        movesMoney: false,
        story:
            'The attacker builds a perfectly valid, properly encrypted payment that says "from alice@demo", but signs it with their own key.',
        defence:
            "Alice's registered public key is on file. The attacker's signature does not match it, so the server rejects the packet.",
        run: async (ctx) => {
            const attacker = await throwawayDevice(ctx.device.vpa);
            const { packet } = await buildPacket(attacker, payment(ctx));
            return [await send('Packet signed by an unregistered key', 'INVALID:bad_signature', packet)];
        },
    },
    {
        id: 'unknown-device',
        title: 'Send from an account with no registered device',
        movesMoney: false,
        story: 'Someone nobody has enrolled (mallory@demo) tries to send a payment.',
        defence:
            'With no registered public key there is nothing to verify against, so the packet is refused. The server also lets this packet be retried later, in case the sender registers afterwards.',
        run: async (ctx) => {
            const stranger = await throwawayDevice('mallory@demo');
            const { packet } = await buildPacket(stranger, payment(ctx));
            return [await send('Unknown sender', 'INVALID:unknown_device', packet)];
        },
    },
    {
        id: 'expired',
        title: 'Replay an old signed payment',
        movesMoney: false,
        story:
            'Someone saved a genuine signed packet and sends it a day later. We simulate this with a packet signed 25 hours ago.',
        defence:
            'The signing time is inside the signed payload, so it cannot be edited. The server rejects anything older than 24 hours.',
        run: async (ctx) => {
            const { packet } = await buildPacket(
                ctx.device,
                payment(ctx, { overrides: { signedAt: Date.now() - 25 * HOUR_MS } }),
            );
            return [await send('Signed 25 hours ago', 'INVALID:stale_packet', packet)];
        },
    },
    {
        id: 'future',
        title: 'Post-date a payment',
        movesMoney: false,
        story: 'A packet that claims it was signed one hour in the future, to slip past the age check.',
        defence: 'The server allows only five minutes of clock difference between phone and server.',
        run: async (ctx) => {
            const { packet } = await buildPacket(
                ctx.device,
                payment(ctx, { overrides: { signedAt: Date.now() + HOUR_MS } }),
            );
            return [await send('Signed one hour in the future', 'INVALID:future_dated', packet)];
        },
    },
    {
        id: 'overdraw',
        title: 'Spend more than you have',
        movesMoney: false,
        story: 'Alice signs a payment of ₹999999, far more than her balance.',
        defence:
            'The signature is genuine, but the balance check fails. The ledger records a REJECTED row and no money moves. The receiver, who already saw "sent" on a phone, is the one left short.',
        run: async (ctx) => {
            const { packet } = await buildPacket(ctx.device, payment(ctx, { amount: 999999 }));
            return [await send('Payment larger than the balance', 'REJECTED:insufficient_balance', packet)];
        },
    },

    {
        id: 'double-spend',
        title: 'Double-spend while offline',
        movesMoney: true,
        story:
            'Alice, offline, signs two payments that together exceed her balance: one to the first account and one to the second. Each looks fine on its own phone.',
        defence:
            'Whichever packet reaches the server first settles and the second is REJECTED. The server cannot stop this while everyone is offline, only detect it afterwards. This is the real limit of the design, and the reason offline UPI uses a pre-funded wallet.',
        run: async (ctx) => {
            const amount = Math.floor(ctx.balance * 0.6);
            if (amount < 1) throw new Error('The sender needs a balance of at least ₹2 for this attack.');
            const [first, second] = others(ctx.device);
            // Both packets are built offline, before either reaches the server.
            const a = await buildPacket(ctx.device, payment(ctx, { receiverVpa: first, amount }));
            const b = await buildPacket(ctx.device, payment(ctx, { receiverVpa: second, amount }));
            return [
                await send(`Spend ₹${amount} on ${first}`, 'SETTLED', a.packet),
                await send(`Spend the same ₹${amount} again on ${second}`, 'REJECTED:insufficient_balance', b.packet),
            ];
        },
    },
    {
        id: 'wallet-limit',
        title: 'Wallet: exceed the per-payment limit',
        movesMoney: false,
        ownsWallet: true,
        story:
            'Alice has ₹1000 in her offline wallet and signs one payment of ₹600. The money exists, but a single stolen or mistaken packet should not be able to take that much.',
        defence:
            'Every wallet has a per-payment limit (₹500 by default). The server rejects the payment before it touches the escrow.',
        run: async (ctx) => {
            await freshWallet(ctx.device.vpa, 1000);
            const { packet } = await buildPacket(ctx.device, payment(ctx, { amount: 600 }));
            return [await send('₹600 against a ₹500 per-payment limit', 'REJECTED:per_transaction_limit', packet)];
        },
    },
    {
        id: 'wallet-allowance',
        title: 'Wallet: spend more than the allowance',
        movesMoney: false,
        ownsWallet: true,
        story:
            "Alice's wallet holds ₹100. She signs a ₹150 payment: under the per-payment limit, but more than the wallet contains.",
        defence:
            'Offline payments are paid out of the escrow, so a payment larger than what is left is rejected. Her account balance is never touched.',
        run: async (ctx) => {
            await freshWallet(ctx.device.vpa, 100);
            const { packet } = await buildPacket(ctx.device, payment(ctx, { amount: 150 }));
            return [await send('₹150 from a ₹100 wallet', 'REJECTED:allowance_exceeded', packet)];
        },
    },
    {
        id: 'wallet-double-spend',
        title: 'Wallet: double-spend, loss capped at the allowance',
        movesMoney: true,
        ownsWallet: true,
        story:
            'The earlier double-spend card put alice\'s whole balance at risk. Here she has a ₹600 wallet and signs two ₹400 payments to two different people while offline.',
        defence:
            'The server still cannot stop this, because both packets are validly signed. Whichever arrives first settles, and the second is rejected. What changed is the damage: the first receiver is guaranteed to be paid, and the most anyone can lose is the allowance, not the balance.',
        run: async (ctx) => {
            const vpa = ctx.device.vpa;
            await freshWallet(vpa, 600);
            const before = (await getWallet(vpa))?.totalSpent ?? 0;
            const [first, second] = others(ctx.device);

            // Both packets are built offline, before either reaches the server.
            const a = await buildPacket(ctx.device, payment(ctx, { receiverVpa: first, amount: 400 }));
            const b = await buildPacket(ctx.device, payment(ctx, { receiverVpa: second, amount: 400 }));

            const steps = [
                await send(`₹400 to ${first}`, 'SETTLED', a.packet),
                await send(`The same ₹400 again, to ${second}`, 'REJECTED:allowance_exceeded', b.packet),
            ];
            const paid = ((await getWallet(vpa))?.totalSpent ?? 0) - before;
            steps.push({
                label: 'Total paid out of the wallet',
                expected: '₹400 (never above the ₹600 allowance)',
                actual: `₹${paid}`,
                ok: paid === 400,
            });
            return steps;
        },
    },
];