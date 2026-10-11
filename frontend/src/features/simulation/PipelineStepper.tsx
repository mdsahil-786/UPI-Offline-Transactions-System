import { useState } from 'react';
import { PIPELINE_STAGES } from '../../api/events';
import type { PipelineStage } from '../../api/events';
import { Badge } from '../../components/Badge';
import type { Run } from '../../hooks/useMeshEvents';
import styles from './PipelineStepper.module.css';

const DESCRIPTIONS: Record<PipelineStage, string> = {
    HASH: 'Fingerprint the ciphertext (SHA-256)',
    CLAIM: 'Claim the fingerprint atomically, so duplicates stop here',
    DECRYPT: 'Unwrap the AES key (RSA-OAEP), decrypt, check the GCM tag',
    VERIFY: "Check the signature against the sender's registered key",
    FRESHNESS: 'Signed within the last 24 hours, not in the future',
    SETTLE: 'Balance check, debit, credit, ledger row',
};

type StepState = 'pass' | 'fail' | 'skipped' | 'pending';

const MARK: Record<StepState, string> = { pass: '✓', fail: '✗', skipped: '–', pending: '·' };

function stateOf(run: Run, stage: PipelineStage): StepState {
    const result = run.stages[stage];
    if (result) return result.status === 'PASS' ? 'pass' : 'fail';
    return run.outcome ? 'skipped' : 'pending';
}

export function PipelineStepper({ runs }: { runs: Run[] }) {
    const [selectedId, setSelectedId] = useState<string | null>(null);

    if (runs.length === 0) {
        return (
            <p className="muted">
                Nothing has reached the backend yet. Send a payment, run gossip, then let the bridge upload.
            </p>
        );
    }

    const run = runs.find((r) => r.ingestId === selectedId) ?? runs[0];

    return (
        <div>
            <div className={styles.head}>
                <span className="mono">{run.packetId}</span>
                <span className="muted">via {run.bridgeNodeId}</span>
                {run.outcome ? <Badge tone={run.outcome} /> : <Badge tone="offline">in progress</Badge>}
            </div>
            {run.reason && <p className="muted">reason: {run.reason}</p>}

            <ol className={styles.steps}>
                {PIPELINE_STAGES.map((stage) => {
                    const state = stateOf(run, stage);
                    return (
                        <li key={stage} className={`${styles.step} ${styles[state]}`}>
                            <span className={styles.mark}>{MARK[state]}</span>
                            <div>
                                <div className={styles.name}>{stage}</div>
                                <div className={styles.desc}>{DESCRIPTIONS[stage]}</div>
                                {run.stages[stage] && <div className={styles.detail}>{run.stages[stage]?.detail}</div>}
                            </div>
                        </li>
                    );
                })}
            </ol>

            {runs.length > 1 && (
                <div className={styles.history}>
                    {runs.map((r) => (
                        <button
                            key={r.ingestId}
                            className={`${styles.chip} ${r.ingestId === run.ingestId ? styles.chipActive : ''}`}
                            onClick={() => setSelectedId(r.ingestId)}
                        >
                            <span className="mono">{r.packetId}</span>
                            {r.outcome ? <Badge tone={r.outcome} /> : <Badge tone="offline">…</Badge>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}