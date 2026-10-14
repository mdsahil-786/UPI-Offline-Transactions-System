import { useState } from 'react';
import type { RunMetrics, SweepResult } from '../../api/types';
import { Table } from '../../components/Table';
import type { Column } from '../../components/Table';
import { pairedDifference } from './stats';
import type { PairedStat } from './stats';
import styles from './Experiments.module.css';

interface MetricOption {
    id: string;
    label: string;
    digits: number;
    pick: (r: RunMetrics) => number | null;
}

const METRICS: MetricOption[] = [
    { id: 'delivery', label: 'Delivery ratio', digits: 3, pick: (r) => r.deliveryRatio },
    { id: 'latency', label: 'Latency (s)', digits: 0, pick: (r) => r.meanLatencySeconds },
    { id: 'overhead', label: 'Overhead ratio', digits: 1, pick: (r) => r.overheadRatio },
    { id: 'relays', label: 'Relays', digits: 0, pick: (r) => r.transmissions },
];

type Row = { x: number; stat: PairedStat | null };

export function PairedPanel({ sweep, xLabel }: { sweep: SweepResult; xLabel: string }) {
    const names = sweep.points[0].algorithms.map((a) => a.algorithm as string);
    const [pickedA, setA] = useState<string>(() => (names.includes('PROPHET') ? 'PROPHET' : names[0]));
    const [pickedB, setB] = useState<string>(() =>
        names.includes('SPRAY_AND_WAIT') ? 'SPRAY_AND_WAIT' : names[names.length - 1],
    );
    const [metricId, setMetricId] = useState('delivery');

    if (names.length < 2) {
        return <p className="muted">Run the sweep with at least two algorithms to compare them.</p>;
    }

    const a = names.includes(pickedA) ? pickedA : names[0];
    const b = names.includes(pickedB) ? pickedB : names[names.length - 1];
    const metric = METRICS.find((m) => m.id === metricId) ?? METRICS[0];

    const rows: Row[] = sweep.values.map((x, i) => {
        const runsOf = (name: string) => sweep.points[i].algorithms.find((s) => s.algorithm === name)?.runs ?? [];
        return { x, stat: pairedDifference(runsOf(a), runsOf(b), metric.pick) };
    });

    const fmt = (v: number) => v.toFixed(metric.digits);
    const columns: Column<Row>[] = [
        { header: xLabel, render: (r) => r.x },
        {
            header: `${a} − ${b}`,
            render: (r) => (r.stat ? `${fmt(r.stat.mean)} ± ${fmt(r.stat.ci95)}` : '—'),
        },
        { header: 'Pairs', render: (r) => r.stat?.n ?? 0 },
        {
            header: 'Verdict',
            render: (r) => {
                if (!r.stat) return 'not enough data';
                if (!r.stat.significant) return 'no clear difference';
                return r.stat.mean > 0 ? `${a} higher` : `${b} higher`;
            },
        },
    ];

    return (
        <div>
            <div className={styles.selects}>
                <label className={styles.field}>
                    <span>Algorithm A</span>
                    <select value={a} onChange={(e) => setA(e.target.value)}>
                        {names.map((n) => (
                            <option key={n}>{n}</option>
                        ))}
                    </select>
                </label>
                <label className={styles.field}>
                    <span>Algorithm B</span>
                    <select value={b} onChange={(e) => setB(e.target.value)}>
                        {names.map((n) => (
                            <option key={n}>{n}</option>
                        ))}
                    </select>
                </label>
                <label className={styles.field}>
                    <span>Metric</span>
                    <select value={metric.id} onChange={(e) => setMetricId(e.target.value)}>
                        {METRICS.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <Table columns={columns} rows={rows} rowKey={(r) => r.x} />

            <p className={styles.sub} style={{ marginTop: 'var(--space-3)' }}>
                Each row is the mean of (A − B) over runs on identical worlds, with a 95% interval from Student's t.
                &quot;Higher&quot; is not &quot;better&quot;: lower is better for latency, overhead and relays. With several sweep
                values, roughly one in twenty rows can look different by chance alone, and a handful of runs only
                roughly satisfies the normality assumption.
            </p>
        </div>
    );
}