import type { AlgorithmSummary, RunMetrics, Stat } from '../../api/types';
import { Table } from '../../components/Table';
import type { Column } from '../../components/Table';
import { ALGORITHM_COLORS } from './ResultCharts';
import styles from './Experiments.module.css';

const fmt = (s: Stat, digits: number) =>
    s.mean === null ? '—' : `${s.mean.toFixed(digits)} ± ${(s.ci95 ?? 0).toFixed(digits)}`;

const num = (v: number | null, digits: number) => (v === null ? '—' : v.toFixed(digits));

function AlgorithmName({ name }: { name: string }) {
    return (
        <span>
      <span className={styles.swatch} style={{ background: ALGORITHM_COLORS[name] ?? '#58a6ff' }} />
            {name}
    </span>
    );
}

const summaryColumns: Column<AlgorithmSummary>[] = [
    { header: 'Algorithm', render: (a) => <AlgorithmName name={a.algorithm} /> },
    { header: 'Delivery ratio', render: (a) => fmt(a.deliveryRatio, 3) },
    { header: 'Latency (s)', render: (a) => fmt(a.latencySeconds, 0) },
    { header: 'Overhead ratio', render: (a) => fmt(a.overheadRatio, 1) },
    { header: 'Hops', render: (a) => fmt(a.hops, 2) },
    { header: 'Relays', render: (a) => fmt(a.transmissions, 0) },
    { header: 'Runs', render: (a) => a.deliveryRatio.n },
];

export function SummaryTable({ summaries }: { summaries: AlgorithmSummary[] }) {
    return <Table columns={summaryColumns} rows={summaries} rowKey={(a) => a.algorithm} />;
}

type Row = RunMetrics & { algorithm: string };

const runColumns: Column<Row>[] = [
    { header: 'Algorithm', render: (r) => <AlgorithmName name={r.algorithm} /> },
    { header: 'Run', render: (r) => r.run },
    { header: 'Delivered', render: (r) => `${r.delivered} / ${r.generated}` },
    { header: 'Ratio', render: (r) => r.deliveryRatio.toFixed(3) },
    { header: 'Latency (s)', render: (r) => num(r.meanLatencySeconds, 0) },
    { header: 'Hops', render: (r) => num(r.meanHops, 2) },
    { header: 'Relays', render: (r) => r.transmissions },
    { header: 'Overhead', render: (r) => num(r.overheadRatio, 1) },
];

export function RunsTable({ summaries }: { summaries: AlgorithmSummary[] }) {
    const rows: Row[] = summaries.flatMap((a) => a.runs.map((r) => ({ ...r, algorithm: a.algorithm })));
    return <Table columns={runColumns} rows={rows} rowKey={(r) => `${r.algorithm}-${r.run}`} />;
}