import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { closeWallet, loadWallet, refundWallet } from '../../api/wallets';
import { Button } from '../../components/Button';
import { ACCOUNTS_KEY, useAccounts } from '../../hooks/useAccounts';
import { WALLETS_KEY, useWalletPolicy, useWallets } from '../../hooks/useWallets';
import styles from './forms.module.css';

const money = (n: number | undefined) => (n === undefined ? '—' : `₹${n.toFixed(2)}`);

export function OfflineAllowance({ vpa }: { vpa: string }) {
    const queryClient = useQueryClient();
    const accounts = useAccounts();
    const wallets = useWallets();
    const policy = useWalletPolicy();

    const [amount, setAmount] = useState('300');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const balance = accounts.data?.find((a) => a.vpa === vpa)?.balance;
    const wallet = wallets.data?.find((w) => w.vpa === vpa);
    const cap = policy.data?.maxAllowance ?? 2000;
    const escrow = wallet?.escrow ?? 0;
    const percent = Math.min(100, (escrow / cap) * 100);
    const value = Number(amount);
    const valueOk = Number.isFinite(value) && value > 0;

    async function run(action: () => Promise<unknown>) {
        setBusy(true);
        setError(null);
        try {
            await action();
            await Promise.all(
                [WALLETS_KEY, ACCOUNTS_KEY].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
            );
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div>
            <p className="muted">
                Money moved here leaves the account balance now and can be spent offline, up to the limits below.
                A payment inside the allowance cannot bounce for lack of funds. It does not stop two payments that
                together exceed it: whichever reaches the server first wins, and the loss is capped at the allowance.
            </p>

            <dl className={styles.kv}>
                <dt>Account balance</dt>
                <dd className="mono">{money(balance)}</dd>
                <dt>Offline wallet</dt>
                <dd className="mono">{wallet ? money(wallet.escrow) : 'none yet'}</dd>
                <dt>Per-payment limit</dt>
                <dd className="mono">{money(wallet?.perTxnLimit ?? policy.data?.perTxnLimit)}</dd>
                <dt>Wallet cap</dt>
                <dd className="mono">{money(cap)}</dd>
                <dt>Loaded / spent so far</dt>
                <dd className="mono">{wallet ? `${money(wallet.totalLoaded)} / ${money(wallet.totalSpent)}` : '—'}</dd>
            </dl>
            <div className={styles.bar}>
                <div className={styles.barFill} style={{ width: `${percent}%` }} />
            </div>

            <div className={styles.row}>
                <label className={styles.field}>
                    <span className="muted">Amount to load (₹)</span>
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={busy}
                    />
                </label>
                <Button onClick={() => run(() => loadWallet(vpa, value))} disabled={busy || !valueOk}>
                    Move to offline wallet
                </Button>
            </div>

            <div className={styles.actions}>
                <Button
                    variant="secondary"
                    onClick={() => run(() => refundWallet(vpa))}
                    disabled={busy || !wallet || escrow <= 0}
                >
                    Return unspent to account
                </Button>
                <Button variant="danger" onClick={() => run(() => closeWallet(vpa))} disabled={busy || !wallet}>
                    Close wallet
                </Button>
            </div>

            {error && <div className={styles.error}>{error}</div>}
        </div>
    );
}