import { Card } from '../../components/Card';
import { AccountsTable } from './AccountsTable';
import { LedgerTable } from './LedgerTable';
import { useAccounts } from '../../hooks/useAccounts';
import { useTransactions } from '../../hooks/useTransactions';
import { useMeshState } from '../../hooks/useMeshState';
import styles from './AdminPage.module.css';

// The H2 console is served by Spring Boot, not Vite, so link to :8080 directly.
const H2_CONSOLE_URL = 'http://localhost:8080/h2-console';

export function AdminPage() {
    const accounts = useAccounts();
    const transactions = useTransactions();
    const mesh = useMeshState();

    const error = accounts.error ?? transactions.error ?? mesh.error;

    return (
        <div className="page">
            <h1>Admin</h1>

            {error && <div className={styles.error}>{error.message}</div>}

            <div className={styles.grid}>
                <Card title="Account Balances">
                    <AccountsTable />
                </Card>

                <Card title="System">
                    <dl className={styles.stats}>
                        <dt>Idempotency cache entries</dt>
                        <dd className="mono">{mesh.data?.idempotencyCacheSize ?? '—'}</dd>

                        <dt>Mesh devices</dt>
                        <dd className="mono">{mesh.data?.devices.length ?? '—'}</dd>

                        <dt>Database</dt>
                        <dd>
                            <a href={H2_CONSOLE_URL} target="_blank" rel="noreferrer">
                                Open H2 console ↗
                            </a>
                            <div className="muted">
                                JDBC URL <code>jdbc:h2:mem:upimesh</code>, user <code>sa</code>, no password
                            </div>
                        </dd>
                    </dl>
                </Card>
            </div>

            <div className={styles.ledger}>
                <Card title="Transaction Ledger (last 20)">
                    <LedgerTable />
                </Card>
            </div>
        </div>
    );
}