import { useEffect, useState } from 'react';
import { Card } from '../../components/Card';
import { loadDevice } from '../../crypto/deviceKeys';
import type { StoredDevice } from '../../crypto/deviceKeys';
import { RegisterDevice } from './RegisterDevice';
import styles from './WalletPage.module.css';

export function WalletPage() {
    const [vpa, setVpa] = useState('alice@demo');
    const [device, setDevice] = useState<StoredDevice | null>(null);

    // Load whichever key this browser holds for the selected account.
    useEffect(() => {
        let cancelled = false;
        setDevice(null);
        loadDevice(vpa).then((d) => {
            if (!cancelled) setDevice(d);
        });
        return () => {
            cancelled = true;
        };
    }, [vpa]);

    return (
        <div className="page">
            <h1>Wallet</h1>
            <p className="muted">
                This browser plays the sender&apos;s phone. It generates its own signing key, registers the
                public half with the server, and keeps the private half where nothing can read it.
            </p>

            <div className={styles.stack}>
                <Card title="1. Device identity">
                    <RegisterDevice vpa={vpa} onVpaChange={setVpa} device={device} onDeviceChange={setDevice} />
                </Card>
            </div>
        </div>
    );
}