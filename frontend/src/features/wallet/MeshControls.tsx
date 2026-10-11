import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { flushBridges, resetMesh, runGossip } from '../../api/mesh';
import type { FlushItem } from '../../api/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Table } from '../../components/Table';
import type { Column } from '../../components/Table';
import { ACCOUNTS_KEY } from '../../hooks/useAccounts';
import { MESH_STATE_KEY, useMeshState } from '../../hooks/useMeshState';
import { TRANSACTIONS_KEY } from '../../hooks/useTransactions';
import styles from './forms.module.css';

const columns: Column<FlushItem>[] = [
    { header: 'Bridge', render: (u) => u.bridgeNode },
    { header: 'Packet', render: (u) => <span className="mono">{u.packetId}</span> },
    { header: 'Outcome', render: (u) => <Badge tone={u.outcome} /> },
    { header: 'Reason', render: (u) => <span className="muted">{u.reason || '—'}</span> },
];

export function MeshControls({ showDevices = true }: { showDevices?: boolean }) {
    const queryClient = useQueryClient();
    const mesh = useMeshState();

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState<string | null>(null);
    const [uploads, setUploads] = useState<FlushItem[]>([]);

    async function run(action: () => Promise<void>) {
        setBusy(true);
        setError(null);
        try {
            await action();
            await Promise.all(
                [MESH_STATE_KEY, ACCOUNTS_KEY, TRANSACTIONS_KEY].map((key) =>
                    queryClient.invalidateQueries({ queryKey: key }),
                ),
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    const gossip = () =>
        run(async () => {
            const r = await runGossip();
            setNote(`Gossip round: ${r.transfers} packet transfer(s).`);
        });

    const upload = () =>
        run(async () => {
            const r = await flushBridges();
            setUploads(r.results);
            setNote(`${r.uploadsAttempted} upload(s) sent to /api/bridge/ingest.`);
        });

    const reset = () =>
        run(async () => {
            await resetMesh();
            setUploads([]);
            setNote('Mesh and idempotency cache cleared.');
        });

    return (
        <div>
            {showDevices && (
                <div className={styles.devices}>
                    {(mesh.data?.devices ?? []).map((d) => (
                        <div key={d.deviceId} className={styles.device}>
                            <strong className="mono">{d.deviceId}</strong>
                            <Badge tone={d.hasInternet ? 'online' : 'offline'}>
                                {d.hasInternet ? '4G' : 'offline'}
                            </Badge>
                            <span className="muted">
          holding {d.packetCount} packet(s) {d.packetIds.join(' ')}
        </span>
                        </div>
                    ))}
                </div>
            )}

            <div className={styles.actions}>
                <Button variant="secondary" onClick={gossip} disabled={busy}>
                    Run gossip round
                </Button>
                <Button variant="secondary" onClick={upload} disabled={busy}>
                    Bridges upload to backend
                </Button>
                <Button variant="danger" onClick={reset} disabled={busy}>
                    Reset mesh and cache
                </Button>
            </div>

            {note && <p className="muted">{note}</p>}
            {error && <div className={styles.error}>{error}</div>}

            {uploads.length > 0 && (
                <div style={{ marginTop: 'var(--space-3)' }}>
                    <Table columns={columns} rows={uploads} rowKey={(u) => `${u.bridgeNode}-${u.packetId}`} />
                </div>
            )}
        </div>
    );
}