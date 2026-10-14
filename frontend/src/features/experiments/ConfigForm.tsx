import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ExperimentConfig, RoutingAlgorithm } from '../../api/types';
import { Button } from '../../components/Button';
import styles from './Experiments.module.css';

type NumericKey = Exclude<keyof ExperimentConfig, 'algorithms'>;
type Draft = Record<NumericKey, string>;

const FIELDS: { key: NumericKey; label: string; hint: string }[] = [
    { key: 'nodes', label: 'Phones', hint: '5 to 100' },
    { key: 'bridges', label: 'Phones with internet', hint: 'at most half of the phones' },
    { key: 'areaSize', label: 'Area side (m)', hint: '100 to 5000' },
    { key: 'range', label: 'Contact range (m)', hint: 'Bluetooth is roughly 10 to 50' },
    { key: 'minSpeed', label: 'Min speed (m/s)', hint: 'must be above 0' },
    { key: 'maxSpeed', label: 'Max speed (m/s)', hint: 'walking is about 1.4' },
    { key: 'maxPauseSteps', label: 'Max pause (s)', hint: 'wait at each waypoint' },
    { key: 'durationSteps', label: 'Duration (s)', hint: '60 to 20000' },
    { key: 'messages', label: 'Payments', hint: '1 to 500' },
    { key: 'generationWindow', label: 'Creation window', hint: 'fraction of the run, 0 to 1' },
    { key: 'ttlSteps', label: 'Packet lifetime (s)', hint: 'a packet expires after this long' },
    { key: 'maxHops', label: 'Hop limit', hint: '0 = unlimited; the demo uses 5' },
    { key: 'sprayCopies', label: 'Spray copies (L)', hint: 'Spray and Wait only' },
    { key: 'runs', label: 'Runs', hint: '1 to 30; more runs, tighter intervals' },
    { key: 'seed', label: 'Seed', hint: 'same seed, same result' },
];

const ALGORITHMS: { id: RoutingAlgorithm; label: string; blurb: string }[] = [
    { id: 'DIRECT', label: 'Direct', blurb: 'the source only hands the packet to a bridge it meets itself' },
    { id: 'EPIDEMIC', label: 'Epidemic', blurb: 'copy to every phone met (what the demo does today)' },
    { id: 'SPRAY_AND_WAIT', label: 'Spray and Wait', blurb: 'limited copies, handed over by halving' },
    { id: 'PROPHET', label: 'PRoPHET', blurb: 'forward only to phones more likely to meet a bridge' },
];

const toDraft = (c: ExperimentConfig): Draft =>
    Object.fromEntries(FIELDS.map((f) => [f.key, String(c[f.key])])) as Draft;

interface Props {
    defaults: ExperimentConfig;
    running: boolean;
    onRun: (config: ExperimentConfig) => void;
    runLabel?: string;
    children?: ReactNode; // extra controls shown just above the buttons
}

export function ConfigForm({ defaults, running, onRun, runLabel = 'Run experiment', children }: Props) {
    const [draft, setDraft] = useState<Draft>(() => toDraft(defaults));
    const [algorithms, setAlgorithms] = useState<RoutingAlgorithm[]>(defaults.algorithms);
    const [problem, setProblem] = useState<string | null>(null);

    function toggle(id: RoutingAlgorithm) {
        setAlgorithms((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
    }

    function submit() {
        const numbers = {} as Record<NumericKey, number>;
        for (const f of FIELDS) {
            const text = draft[f.key].trim();
            const value = Number(text);
            if (text === '' || !Number.isFinite(value)) {
                setProblem(`${f.label} must be a number`);
                return;
            }
            numbers[f.key] = value;
        }
        if (algorithms.length === 0) {
            setProblem('Choose at least one algorithm');
            return;
        }
        setProblem(null);
        onRun({ ...numbers, algorithms });
    }

    function reset() {
        setDraft(toDraft(defaults));
        setAlgorithms(defaults.algorithms);
        setProblem(null);
    }

    return (
        <div>
            <div className={styles.fields}>
                {FIELDS.map((f) => (
                    <label key={f.key} className={styles.field}>
                        <span>{f.label}</span>
                        <input
                            inputMode="decimal"
                            value={draft[f.key]}
                            onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                            disabled={running}
                        />
                        <small className="muted">{f.hint}</small>
                    </label>
                ))}
            </div>

            <div className={styles.algorithms}>
                {ALGORITHMS.map((a) => (
                    <label key={a.id} className={styles.algorithm}>
                        <input
                            type="checkbox"
                            checked={algorithms.includes(a.id)}
                            onChange={() => toggle(a.id)}
                            disabled={running}
                        />
                        <span>
              <strong>{a.label}</strong> <span className="muted">{a.blurb}</span>
            </span>
                    </label>
                ))}
            </div>

            {children}

            {problem && <div className={styles.error}>{problem}</div>}

            <div className={styles.actions}>
                <Button onClick={submit} disabled={running}>
                    {running ? 'Running… this can take several seconds' : runLabel}
                </Button>
                <Button variant="secondary" onClick={reset} disabled={running}>
                    Reset to defaults
                </Button>
            </div>
        </div>
    );
}