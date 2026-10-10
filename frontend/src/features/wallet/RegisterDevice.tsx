import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { registerDevice } from '../../api/devices';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { deleteDevice, exportPublicKeySpki, generateDevice } from '../../crypto/deviceKeys';
import type { StoredDevice } from '../../crypto/deviceKeys';
import { useAccounts } from '../../hooks/useAccounts';
import { DEVICES_KEY, useDevices } from '../../hooks/useDevices';
import styles from './RegisterDevice.module.css';

interface Props {
    vpa: string;
    onVpaChange: (vpa: string) => void;
    device: StoredDevice | null;
    onDeviceChange: (device: StoredDevice | null) => void;
}

type Status = 'none' | 'unregistered' | 'registered' | 'stale';

export function RegisterDevice({ vpa, onVpaChange, device, onDeviceChange }: Props) {
    const queryClient = useQueryClient();
    const accounts = useAccounts();
    const devices = useDevices();

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [publicKey, setPublicKey] = useState('');

    // Show the public key of whichever key this browser currently holds.
    useEffect(() => {
        let cancelled = false;
        if (!device) {
            setPublicKey('');
            return;
        }
        exportPublicKeySpki(device.publicKey).then((k) => {
            if (!cancelled) setPublicKey(k);
        });
        return () => {
            cancelled = true;
        };
    }, [device]);

    // Compare this browser's key with what the server has on file for this VPA.
    const serverDevice = devices.data?.find((d) => d.vpa === vpa);
    let status: Status;
    if (!device) status = 'none';
    else if (!serverDevice) status = 'unregistered';
    else if (serverDevice.deviceId === device.deviceId) status = 'registered';
    else status = 'stale';

    const label: Record<Status, string> = {
        none: 'No key in this browser',
        unregistered: 'Not registered',
        registered: 'Registered',
        stale: 'Key mismatch',
    };
    const hint: Record<Status, string> = {
        none:
            'The server holds a demo key for this account, so packets signed here would be rejected. ' +
            'Register a key to make this browser the sender.',
        unregistered: 'This browser has a key, but the server does not know about it yet.',
        registered: 'The server will accept packets signed by this browser for this account.',
        stale:
            'The server has a different key on file (registered from elsewhere). ' +
            'Packets signed here will fail with bad_signature until you register again.',
    };

    async function handleRegister() {
        setBusy(true);
        setError(null);
        try {
            const created = await generateDevice(vpa);
            await registerDevice({
                vpa: created.vpa,
                deviceId: created.deviceId,
                publicKey: await exportPublicKeySpki(created.publicKey),
            });
            onDeviceChange(created);
            await queryClient.invalidateQueries({ queryKey: DEVICES_KEY });
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    async function handleForget() {
        setError(null);
        await deleteDevice(vpa);
        onDeviceChange(null);
    }

    const options = accounts.data?.map((a) => a.vpa) ?? [vpa];

    return (
        <div>
            <div className={styles.row}>
                <label className={styles.field}>
                    <span className="muted">Account</span>
                    <select value={vpa} onChange={(e) => onVpaChange(e.target.value)} disabled={busy}>
                        {options.map((v) => (
                            <option key={v} value={v}>
                                {v}
                            </option>
                        ))}
                    </select>
                </label>
                <Badge tone={status === 'registered' ? 'online' : 'offline'}>{label[status]}</Badge>
            </div>

            <p className="muted">{hint[status]}</p>

            {device && (
                <dl className={styles.details}>
                    <dt>Device ID</dt>
                    <dd className="mono">{device.deviceId}</dd>
                    <dt>Created</dt>
                    <dd>{new Date(device.createdAt).toLocaleString()}</dd>
                    <dt>Public key (X.509 SPKI, base64)</dt>
                    <dd>
                        <pre className={styles.key}>{publicKey}</pre>
                    </dd>
                    <dt>Private key</dt>
                    <dd className="muted">
                        Non-extractable. Stored in this browser&apos;s IndexedDB. Its bytes can never be read,
                        only used to sign.
                    </dd>
                </dl>
            )}

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
                <Button onClick={handleRegister} disabled={busy}>
                    {busy ? 'Registering…' : device ? 'Generate new key and re-register' : 'Generate key and register'}
                </Button>
                {device && (
                    <Button variant="danger" onClick={handleForget} disabled={busy}>
                        Forget key in this browser
                    </Button>
                )}
            </div>
        </div>
    );
}