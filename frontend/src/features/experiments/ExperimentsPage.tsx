import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getExperimentDefaults, runExperiment } from '../../api/experiments';
import type { ExperimentConfig } from '../../api/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfigForm } from './ConfigForm';
import { downloadText, runsToCsv, summaryToCsv } from './csv';
import { MetricChart } from './ResultCharts';
import { RunsTable, SummaryTable } from './ResultTables';
import styles from './Experiments.module.css';

export function ExperimentsPage() {
    const defaults = useQuery({
        queryKey: ['experiment-defaults'],
        queryFn: ({ signal }) => getExperimentDefaults(signal),
        staleTime: Infinity,
    });
    const mutation = useMutation({ mutationFn: runExperiment });
    const [elapsedMs, setElapsedMs] = useState<number | null>(null);

    function run(config: ExperimentConfig) {
        const started = performance.now();
        setElapsedMs(null);
        mutation.mutate(config, { onSuccess: () => setElapsedMs(performance.now() - started) });
    }

    const result = mutation.data;
    const c = result?.config;

    return (
        <div className="page">
            <h1>Routing experiments</h1>
            <p className="muted">
                A packet counts as delivered when it reaches any phone with internet. Each algorithm is run on
                the same simulated world (same seeds), so the comparison is paired. Intervals are 95% confidence
                intervals over the runs.
            </p>

            <div className={styles.stack}>
                <Card title="1. Scenario">
                    {defaults.isLoading && <p className="muted">Loading defaults…</p>}
                    {defaults.error && <div className={styles.error}>{defaults.error.message}</div>}
                    {defaults.data && (
                        <ConfigForm defaults={defaults.data} running={mutation.isPending} onRun={run} />
                    )}
                    {mutation.error && <div className={styles.error}>{mutation.error.message}</div>}
                </Card>

                {result && c && (
                    <>
                        <Card title="2. Summary (mean ± 95% confidence interval)">
                            <p className={styles.sub}>
                                {c.nodes} phones ({c.bridges} with internet), {c.areaSize} m square, {c.range} m range,{' '}
                                {c.durationSteps} s, {c.messages} payments, hop limit {c.maxHops === 0 ? 'none' : c.maxHops},{' '}
                                {c.runs} runs, seed {c.seed}
                                {elapsedMs !== null && ` · computed in ${(elapsedMs / 1000).toFixed(1)} s`}
                            </p>
                            <SummaryTable summaries={result.algorithms} />
                            <div className={styles.actions}>
                                <Button
                                    variant="secondary"
                                    onClick={() => downloadText('routing-summary.csv', summaryToCsv(result), 'text/csv')}
                                >
                                    Download summary CSV
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => downloadText('routing-runs.csv', runsToCsv(result), 'text/csv')}
                                >
                                    Download per-run CSV
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() =>
                                        downloadText('routing-config.json', JSON.stringify(result.config, null, 2), 'application/json')
                                    }
                                >
                                    Download configuration
                                </Button>
                            </div>
                        </Card>

                        <div className={styles.charts}>
                            <Card title="Delivery ratio">
                                <MetricChart
                                    subtitle="Share of payments that reached a phone with internet. Higher is better."
                                    algorithms={result.algorithms}
                                    pick={(a) => a.deliveryRatio}
                                    digits={3}
                                    unitScale
                                />
                            </Card>
                            <Card title="Latency (seconds)">
                                <MetricChart
                                    subtitle="Mean time to reach a bridge, over delivered payments only. Lower is better."
                                    algorithms={result.algorithms}
                                    pick={(a) => a.latencySeconds}
                                    digits={0}
                                />
                            </Card>
                            <Card title="Overhead ratio">
                                <MetricChart
                                    subtitle="Extra copies sent per delivered payment: (relays − delivered) ÷ delivered. Lower is better."
                                    algorithms={result.algorithms}
                                    pick={(a) => a.overheadRatio}
                                    digits={1}
                                />
                            </Card>
                            <Card title="Hops">
                                <MetricChart
                                    subtitle="Mean number of phone-to-phone transfers before reaching a bridge."
                                    algorithms={result.algorithms}
                                    pick={(a) => a.hops}
                                    digits={2}
                                />
                            </Card>
                        </div>

                        <Card title="3. Per-run results">
                            <details>
                                <summary>Show all {result.algorithms.reduce((n, a) => n + a.runs.length, 0)} rows</summary>
                                <RunsTable summaries={result.algorithms} />
                            </details>
                        </Card>

                        <Card title="How to read this">
                            <ul className={styles.notes}>
                                <li>
                                    <strong>Latency is conditional.</strong> It is averaged over delivered payments only, so an
                                    algorithm that delivers little can look fast. Always read it next to the delivery ratio.
                                </li>
                                <li>
                                    <strong>Overlapping error bars do not prove a tie.</strong> Runs with the same index share
                                    the same world across algorithms. For a fair test, take the per-run difference between two
                                    algorithms from the per-run CSV and look at that.
                                </li>
                                <li>
                                    <strong>Model limits.</strong> Mobility is random waypoint (synthetic), bandwidth and
                                    buffers are unlimited, and there are no acknowledgements, so copies keep spreading after a
                                    payment is delivered. Say so when you present results.
                                </li>
                            </ul>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}