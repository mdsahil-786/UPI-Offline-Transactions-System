import type { OfflineWallet } from '../../api/types';
import { Table } from '../../components/Table';
import type { Column } from '../../components/Table';
import { useWallets } from '../../hooks/useWallets';

const money = (n: number) => `₹${n.toFixed(2)}`;

const columns: Column<OfflineWallet>[] = [
    { header: 'VPA', render: (w) => <span className="mono">{w.vpa}</span> },
    { header: 'Escrow left', render: (w) => <span className="mono">{money(w.escrow)}</span> },
    { header: 'Per-payment limit', render: (w) => money(w.perTxnLimit) },
    { header: 'Loaded', render: (w) => money(w.totalLoaded) },
    { header: 'Spent', render: (w) => money(w.totalSpent) },
];

export function WalletsTable() {
    const { data } = useWallets();
    return (
        <Table
            columns={columns}
            rows={data}
            rowKey={(w) => w.vpa}
            emptyText="No offline wallets. Load one from the Wallet page."
        />
    );
}