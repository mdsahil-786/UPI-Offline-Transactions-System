import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { loadDevice } from '../../crypto/deviceKeys';
import type { StoredDevice } from '../../crypto/deviceKeys';
import { useMeshEvents } from '../../hooks/useMeshEvents';
import { useMeshState } from '../../hooks/useMeshState';
import { AccountsTable } from '../admin/AccountsTable';
import { LedgerTable } from '../admin/LedgerTable';
import { ComposePayment } from '../wallet/ComposePayment';
import { MeshControls } from '../wallet/MeshControls';
import { PhoneCard } from './PhoneCard';
import { PipelineStepper } from './PipelineStepper';
import styles from './SimulationPage.module.css';
import { MeshGraph } from './MeshGraph';
import { useDevices } from '../../hooks/useDevices';

const SENDER_VPA = 'alice@demo';

const STATUS_LABEL = {
    connecting: 'Connecting…',
    live: 'Live',
    reconnecting: 'Reconnecting…',
} as const;

export function SimulationPage() {
    const mesh = useMeshState();
    const events = useMeshEvents();
    const [device, setDevice] = useState<StoredDevice | null>(null);
    const devices = useDevices();
    const serverDevice = devices.data?.find((d) => d.vpa === SENDER_VPA);
    const checking = devices.data === undefined;
    const registered = device !== null && serverDevice?.deviceId === device.deviceId;

    useEffect(() => {
        let cancelled = false;
        loadDevice(SENDER_VPA).then((d) => {
            if (!cancelled) setDevice(d);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    // Phones a packet is currently flying towards.
    const receiving = new Set(events.flights.map((f) => f.to));

    return (
        <div className="page">
            <div className={styles.header}>
                <h1>Live Simulation</h1>
                <Badge tone={events.status === 'live' ? 'online' : 'offline'}>
                    {STATUS_LABEL[events.status]}
                </Badge>
            </div>
            <p className="muted">
                Everything here is driven by events the backend streams as they happen. Send a payment, let it
                gossip across the phones, then watch the bridge upload it through the server pipeline.
            </p>

            <div className={styles.top}>
                <Card title="1. Send a payment">
                    {checking ? (
                        <p className="muted">Checking device registration…</p>
                    ) : device && registered ? (
                        <ComposePayment device={device} onBuilt={() => undefined} />
                    ) : (
                        <p className="muted">
                            {device
                                ? `The server has a different key on file for ${SENDER_VPA} (it was restarted, or the key was replaced elsewhere), so payments signed here would be rejected as bad_signature.`
                                : `This browser has no key for ${SENDER_VPA}.`}{' '}
                            Register one in the <Link to="/wallet">Wallet</Link> first.
                        </p>
                    )}
                </Card>
                <Card title="2. Move it along">
                    <MeshControls showDevices={false} />
                </Card>
            </div>

            <div className={styles.columns}>
                <Card title="Phones">
                    {(mesh.data?.devices ?? []).map((d) => (
                        <PhoneCard key={d.deviceId} device={d} active={receiving.has(d.deviceId)} />
                    ))}
                </Card>

                <div className={styles.center}>
                    <Card title="Mesh">
                        <MeshGraph devices={mesh.data?.devices ?? []} flights={events.flights} />
                    </Card>
                    <Card title="Event log">
                        {events.log.length === 0 ? (
                            <p className="muted">Waiting for events…</p>
                        ) : (
                            <ul className={styles.log}>
                                {events.log.map((line) => (
                                    <li key={line.key}>
                                        <span className={styles.time}>{new Date(line.ts).toLocaleTimeString()}</span>
                                        {line.text}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>

                <Card title="Backend pipeline">
                    <PipelineStepper runs={events.runs} />
                </Card>
            </div>

            <div className={styles.bottom}>
                <Card title="Account balances">
                    <AccountsTable />
                </Card>
                <Card title="Transaction ledger">
                    <LedgerTable />
                </Card>
            </div>
        </div>
    );
}