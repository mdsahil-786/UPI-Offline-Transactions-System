import { Table } from '../../components/Table';
import type { Column } from '../../components/Table';
import type { Account } from '../../api/types';
import { useAccounts } from '../../hooks/useAccounts';

const columns: Column<Account>[] = [
    { header: 'VPA', render: (a) => <span className="mono">{a.vpa}</span> },
    { header: 'Holder', render: (a) => a.holderName },
    {
        header: 'Balance',
        render: (a) => <span className="mono">₹{Number(a.balance).toFixed(2)}</span>,
    },
    { header: 'Version', render: (a) => <span className="muted">{a.version}</span> },
];

export function AccountsTable() {
    const { data } = useAccounts();
    return <Table columns={columns} rows={data} rowKey={(a) => a.vpa} emptyText="No accounts." />;
}