import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { injectPacket } from '../../api/mesh';
import { Button } from '../../components/Button';
import { buildPacket } from '../../crypto/packetBuilder';
import type { BuiltPacket } from '../../crypto/packetBuilder';
import type { StoredDevice } from '../../crypto/deviceKeys';
import { useAccounts } from '../../hooks/useAccounts';
import { MESH_STATE_KEY, useMeshState } from '../../hooks/useMeshState';
import styles from './forms.module.css';

interface Props {
    device: StoredDevice | null;
    onBuilt: (built: BuiltPacket) => void;
}

export function ComposePayment({ device, onBuilt }: Props) {
    const queryClient = useQueryClient();
    const accounts = useAccounts();
    const mesh = useMeshState();

    const [receiver, setReceiver] = useState('');
    const [amount, setAmount] = useState('25');
    const [pin, setPin] = useState('1234');
    const [startDevice, setStartDevice] = useState('phone-alice');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);

    if (!device) {
        return <p className="muted">Register a device in step 1 first. The sender key signs every payment.</p>;
    }

    const receivers = (accounts.data ?? []).map((a) => a.vpa).filter((v) => v !== device.vpa);
    const effectiveReceiver = receivers.includes(receiver) ? receiver : (receivers[0] ?? '');
    const offlineDevices = (mesh.data?.devices ?? []).filter((d) => !d.hasInternet).map((d) => d.deviceId);
    const startOptions = offlineDevices.length > 0 ? offlineDevices : ['phone-alice'];

    const value = Number(amount);
    const amountOk = Number.isFinite(value) && value > 0;
    const pinOk = /^\d{4,6}$/.test(pin);

    async function handleSend() {
        if (!device) return;
        setBusy(true);
        setError(null);
        setResult(null);
        try {
            const built = await buildPacket(device, {
                receiverVpa: effectiveReceiver,
                amount: value,
                pin,
                ttl: 5,
            });
            const res = await injectPacket(startDevice, built.packet);
            onBuilt(built);
            setResult(`Packet ${res.packetId.slice(0, 8)} signed, encrypted and injected at ${res.injectedAt}.`);
            await queryClient.invalidateQueries({ queryKey: MESH_STATE_KEY });
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <div className={styles.row}>
                <div className={styles.field}>
                    <span className="muted">From</span>
                    <strong className="mono">{device.vpa}</strong>
                </div>
                <label className={styles.field}>
                    <span className="muted">To</span>
                    <select value={effectiveReceiver} onChange={(e) => setReceiver(e.target.value)} disabled={busy}>
                        {receivers.map((v) => (
                            <option key={v} value={v}>
                                {v}
                            </option>
                        ))}
                    </select>
                </label>
                <label className={styles.field}>
                    <span className="muted">Amount (₹)</span>
                    <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={busy}
                    />
                </label>
                <label className={styles.field}>
                    <span className="muted">PIN</span>
                    <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        disabled={busy}
                    />
                </label>
                <label className={styles.field}>
                    <span className="muted">Starts at phone</span>
                    <select value={startDevice} onChange={(e) => setStartDevice(e.target.value)} disabled={busy}>
                        {startOptions.map((id) => (
                            <option key={id} value={id}>
                                {id}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className={styles.actions}>
                <Button onClick={handleSend} disabled={busy || !amountOk || !pinOk || !effectiveReceiver}>
                    {busy ? 'Working…' : 'Sign, encrypt and inject into mesh'}
                </Button>
            </div>
            {!pinOk && <p className="muted">PIN must be 4 to 6 digits.</p>}

            {result && <div className={styles.note}>{result}</div>}
            {error && <div className={styles.error}>{error}</div>}
        </div>
    );
}