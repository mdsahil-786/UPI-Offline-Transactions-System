import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getAccounts } from '../../api/accounts';
import { Button } from '../../components/Button';
import { loadDevice } from '../../crypto/deviceKeys';
import type { StoredDevice } from '../../crypto/deviceKeys';
import { ACCOUNTS_KEY } from '../../hooks/useAccounts';
import { useDevices } from '../../hooks/useDevices';
import { MESH_STATE_KEY } from '../../hooks/useMeshState';
import { TRANSACTIONS_KEY } from '../../hooks/useTransactions';
import { AttackCard } from './AttackCard.tsx';
import type { AttackResult } from './AttackCard.tsx';
import { ATTACKS } from './attacks';
import type { Attack } from './attacks';
import styles from './SecurityLabPage.module.css';
import { closeWallet } from '../../api/wallets';
import { WALLETS_KEY } from '../../hooks/useWallets';

const SENDER_VPA = 'alice@demo';

export function SecurityLabPage() {
    const queryClient = useQueryClient();
    const devices = useDevices();

    const [device, setDevice] = useState<StoredDevice | null>(null);
    const [results, setResults] = useState<Record<string, AttackResult>>({});
    const [running, setRunning] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        loadDevice(SENDER_VPA).then((d) => {
            if (!cancelled) setDevice(d);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    // The attacks only make sense if the server will accept this browser's key for alice.
    const serverDevice = devices.data?.find((d) => d.vpa === SENDER_VPA);
    const ready = device !== null && serverDevice?.deviceId === device.deviceId;
    const busy = running !== null;

    async function runAttack(attack: Attack) {
        if (!device) return;
        setRunning(attack.id);
        let outcome: AttackResult;
        try {
            // Baseline cards run with no offline wallet. The wallet cards set up their own.
            if (!attack.ownsWallet) await closeWallet(device.vpa);
            const accounts = await getAccounts();
            const balance = Number(accounts.find((a) => a.vpa === device.vpa)?.balance ?? 0);
            outcome = { steps: await attack.run({ device, balance }) };
        } catch (e) {
            outcome = { error: e instanceof Error ? e.message : String(e) };
        }
        setResults((prev) => ({ ...prev, [attack.id]: outcome }));
        setRunning(null);
        await Promise.all(
            [ACCOUNTS_KEY, TRANSACTIONS_KEY, MESH_STATE_KEY, WALLETS_KEY].map((key) =>
                queryClient.invalidateQueries({ queryKey: key }),
            ),
        );
    }

    async function runAll() {
        for (const attack of ATTACKS) await runAttack(attack);
    }

    const finished = ATTACKS.filter((a) => results[a.id]);
    const passed = finished.filter((a) => {
        const r = results[a.id];
        return 'steps' in r && r.steps.every((s) => s.ok);
    }).length;

    return (
        <div className="page">
            <h1>Security Lab</h1>
            <p className="muted">
                Each card plays an attacker against the server, using {SENDER_VPA} as the victim. Packets go
                straight to <code>/api/bridge/ingest</code> as a bridge called <code>security-lab</code>. The
                Server said column is the real answer from the backend, compared with what the design promises.
            </p>

            {!ready && (
                <div className={styles.notice}>
                    This browser does not have a registered key for {SENDER_VPA}. Go to the{' '}
                    <Link to="/wallet">Wallet</Link>, register a device, then come back.
                </div>
            )}

            <div className={styles.bar}>
                <Button onClick={runAll} disabled={!ready || busy}>
                    Run all attacks
                </Button>
                <span className="muted">
          {finished.length === 0
              ? 'Nothing run yet.'
              : `${passed} of ${ATTACKS.length} matched expectations (${finished.length} run).`}
        </span>
            </div>
            <p className="muted">
                Cards tagged "moves money" change real balances in this demo. Restart Spring Boot to reset them.
            </p>

            <div className={styles.stack}>
                {ATTACKS.map((attack) => (
                    <AttackCard
                        key={attack.id}
                        attack={attack}
                        result={results[attack.id]}
                        running={running === attack.id}
                        disabled={!ready || busy}
                        onRun={() => runAttack(attack)}
                    />
                ))}
            </div>
        </div>
    );
}