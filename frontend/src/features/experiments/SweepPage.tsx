import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getExperimentDefaults, runSweep } from '../../api/experiments';
import type { ExperimentConfig, SweepParameter } from '../../api/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfigForm } from './ConfigForm';
import { downloadText, sweepToCsv } from './csv';
import { PairedPanel } from './PairedPanel';
import { SweepChart } from './SweepChart';
import styles from './Experiments.module.css';

interface ParameterOption {
    id: SweepParameter;
    label: string;
    xLabel: string;
    suggested: string;
    hint: string;
}

const PARAMETERS: ParameterOption[] = [
    {
        id: 'MAX_HOPS',
        label: 'Hop limit',
        xLabel: 'hop limit',
        suggested: '1, 2, 3, 4, 5, 6, 8, 10',
        hint: 'Phone-to-phone transfers a packet may make. The demo uses 5. Use a large number such as 20 instead of 0 (unlimited), which would plot at the far left. At 1, every algorithm should deliver the same payments.',
    },
    {
        id: 'TTL_STEPS',
        label: 'Packet lifetime (s)',
        xLabel: 'packet lifetime (s)',
        suggested: '300, 600, 1200, 1800, 2700, 3600, 5400, 7200',
        hint: 'How long a packet may keep spreading before it expires.',
    },
    {
        id: 'RANGE',
        label: 'Contact range (m)',
        xLabel: 'contact range (m)',
        suggested: '10, 20, 30, 40, 60, 80, 100',
        hint: 'How close two phones must be to exchange packets.',
    },
    {
        id: 'NODES',
        label: 'Number of phones',
        xLabel: 'phones',
        suggested: '10, 20, 30, 40, 60, 80',
        hint: 'Changes the simulated world itself, so values no longer share identical worlds. Heavier: allow up to a minute.',
    },
    {
        id: 'BRIDGES',
        label: 'Phones with internet',
        xLabel: 'phones with internet',
        suggested: '1, 2, 3, 4, 6, 8',
        hint: 'Changes which phones create payments, so worlds are only mostly shared.',
    },
    {
        id: 'SPRAY_COPIES',
        label: 'Spray copies (L)',
        xLabel: 'spray copies L',
        suggested: '2, 4, 8, 16, 32',
        hint: 'Only Spray and Wait depends on this; the other lines stay flat.',
    },
];

interface SweepRequest {
    scenario: ExperimentConfig;
    parameter: SweepParameter;
    values: number[];
}

function parseValues(text: string): number[] | string {
    const parts = text.split(/[\s,]+/).filter(Boolean);
    const numbers = parts.map(Number);
    if (numbers.some((n) => !Number.isFinite(n))) return 'Sweep values must be numbers separated by commas';
    if (numbers.length < 2 || numbers.length > 12) return 'Give between 2 and 12 sweep values';
    return numbers;
}

export function SweepPage() {
    const defaults = useQuery({
        queryKey: ['experiment-defaults'],
        queryFn: ({ signal }) => getExperimentDefaults(signal),
        staleTime: Infinity,
    });
    const mutation = useMutation({
        mutationFn: (req: SweepRequest) => runSweep(req.scenario, req.parameter, req.values),
    });

    const [parameter, setParameter] = useState<SweepParameter>('MAX_HOPS');
    const [valuesText, setValuesText] = useState(PARAMETERS[0].suggested);
    const [valuesProblem, setValuesProblem] = useState<string | null>(null);
    const [lastRequest, setLastRequest] = useState<SweepRequest | null>(null);
    const [elapsedMs, setElapsedMs] = useState<number | null>(null);

    const chosen = PARAMETERS.find((p) => p.id === parameter) ?? PARAMETERS[0];

    function choose(id: SweepParameter) {
        setParameter(id);
        setValuesText((PARAMETERS.find((p) => p.id === id) ?? PARAMETERS[0]).suggested);
    }

    function run(config: ExperimentConfig) {
        const parsed = parseValues(valuesText);
        if (typeof parsed === 'string') {
            setValuesProblem(parsed);
            return;
        }
        setValuesProblem(null);
        const request: SweepRequest = { scenario: config, parameter, values: parsed };
        setLastRequest(request);
        setElapsedMs(null);
        const started = performance.now();
        mutation.mutate(request, { onSuccess: () => setElapsedMs(performance.now() - started) });
    }

    const result = mutation.data;
    const meta = result ? (PARAMETERS.find((p) => p.id === result.parameter) ?? PARAMETERS[0]) : chosen;

    return (
        <div className="page">
            <h1>Parameter sweeps</h1>
            <p className="muted">
                Run the same scenario at several values of one setting and see how each algorithm responds. Every
                algorithm and every value uses the same seeds, so the comparison is paired; bands are 95%
                confidence intervals over the runs.
            </p>

            <div className={styles.stack}>
                <Card title="1. Scenario and sweep">
                    {defaults.isLoading && <p className="muted">Loading defaults…</p>}
                    {defaults.error && <div className={styles.error}>{defaults.error.message}</div>}
                    {defaults.data && (
                        <ConfigForm
                            defaults={defaults.data}
                            running={mutation.isPending}
                            onRun={run}
                            runLabel="Run sweep"
                        >
                            <div className={styles.sweepBox}>
                                <strong>Sweep</strong>
                                <div className={styles.selects}>
                                    <label className={styles.field}>
                                        <span>Setting to vary</span>
                                        <select
                                            value={parameter}
                                            onChange={(e) => choose(e.target.value as SweepParameter)}
                                            disabled={mutation.isPending}
                                        >
                                            {PARAMETERS.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className={styles.field} style={{ flex: 1, minWidth: 260 }}>
                                        <span>Values (2 to 12, comma separated)</span>
                                        <input
                                            value={valuesText}
                                            onChange={(e) => setValuesText(e.target.value)}
                                            disabled={mutation.isPending}
                                        />
                                    </label>
                                </div>
                                <small className="muted">
                                    {chosen.hint} The value of this setting in the scenario above is ignored.
                                </small>
                                {valuesProblem && <div className={styles.error}>{valuesProblem}</div>}
                            </div>
                        </ConfigForm>
                    )}
                    {mutation.error && <div className={styles.error}>{mutation.error.message}</div>}
                </Card>

                {result && (
                    <>
                        <Card title="2. Results">
                            <p className={styles.sub}>
                                {result.values.length} values of <strong>{meta.label}</strong>:{' '}
                                {result.values.join(', ')}
                                {elapsedMs !== null && ` · computed in ${(elapsedMs / 1000).toFixed(1)} s`}
                            </p>
                            <div className={styles.actions}>
                                <Button
                                    variant="secondary"
                                    onClick={() => downloadText('routing-sweep.csv', sweepToCsv(result), 'text/csv')}
                                >
                                    Download sweep CSV
                                </Button>
                                {lastRequest && (
                                    <Button
                                        variant="secondary"
                                        onClick={() =>
                                            downloadText(
                                                'routing-sweep-request.json',
                                                JSON.stringify(lastRequest, null, 2),
                                                'application/json',
                                            )
                                        }
                                    >
                                        Download request (to repeat it)
                                    </Button>
                                )}
                            </div>
                        </Card>

                        <div className={styles.charts}>
                            <Card title="Delivery ratio">
                                <p className={styles.sub}>Share of payments that reached a phone with internet. Higher is better.</p>
                                <SweepChart
                                    sweep={result}
                                    xLabel={meta.xLabel}
                                    pick={(a) => a.deliveryRatio}
                                    digits={3}
                                    unitScale
                                />
                            </Card>
                            <Card title="Latency (seconds)">
                                <p className={styles.sub}>Delivered payments only, so read it next to the delivery ratio.</p>
                                <SweepChart sweep={result} xLabel={meta.xLabel} pick={(a) => a.latencySeconds} digits={0} />
                            </Card>
                            <Card title="Overhead ratio">
                                <p className={styles.sub}>Extra copies per delivered payment. Lower is better.</p>
                                <SweepChart sweep={result} xLabel={meta.xLabel} pick={(a) => a.overheadRatio} digits={1} />
                            </Card>
                            <Card title="Relays">
                                <p className={styles.sub}>Total phone-to-phone and phone-to-bridge copies per run.</p>
                                <SweepChart sweep={result} xLabel={meta.xLabel} pick={(a) => a.transmissions} digits={0} />
                            </Card>
                        </div>

                        <Card title="3. Paired comparison of two algorithms">
                            <PairedPanel sweep={result} xLabel={meta.xLabel} />
                        </Card>

                        <Card title="How to read this">
                            <ul className={styles.notes}>
                                <li>
                                    <strong>Shared worlds.</strong> Hop limit, packet lifetime, contact range and spray copies
                                    do not change the random draws, so every value is evaluated on exactly the same worlds and
                                    the curves are smooth because of it. The number of phones changes the world; the number of
                                    bridges changes who sends.
                                </li>
                                <li>
                                    <strong>Overhead and latency can have gaps.</strong> A run in which nothing was delivered has
                                    no latency or overhead. It is left out of that point's mean, so a point can rest on fewer
                                    runs than the delivery ratio does.
                                </li>
                                <li>
                                    <strong>Model limits still apply.</strong> Mobility is random waypoint, bandwidth and buffers
                                    are unlimited, and there are no acknowledgements.
                                </li>
                            </ul>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}