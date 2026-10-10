import { Table } from '../../components/Table';
import type { Column } from '../../components/Table';
import { Badge } from '../../components/Badge';
import type { Transaction } from '../../api/types';
import { useTransactions } from '../../hooks/useTransactions';

const columns: Column<Transaction>[] = [
    { header: 'ID', render: (t) => t.id },
    { header: 'From', render: (t) => t.senderVpa },
    { header: 'To', render: (t) => t.receiverVpa },
    {
        header: 'Amount',
        render: (t) => <span className="mono">₹{Number(t.amount).toFixed(2)}</span>,
    },
    { header: 'Status', render: (t) => <Badge tone={t.status} /> },
    { header: 'Bridge', render: (t) => t.bridgeNodeId },
    { header: 'Hops', render: (t) => t.hopCount },
    {
        header: 'Hash',
        render: (t) => <span className="mono muted">{t.packetHash.slice(0, 10)}…</span>,
    },
    {
        header: 'Settled',
        render: (t) => (
            <span className="muted">{new Date(t.settledAt).toLocaleTimeString()}</span>
        ),
    },
];

export function LedgerTable() {
    const { data } = useTransactions();
    return (
        <Table
            columns={columns}
            rows={data}
            rowKey={(t) => t.id}
            emptyText="No transactions yet. Settle a packet and it will appear here."
        />
    );
}