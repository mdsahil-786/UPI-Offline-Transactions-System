import type { Outcome } from '../../api/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Table } from '../../components/Table';
import type { Column } from '../../components/Table';
import type { Attack, StepResult } from './attacks';
import styles from './AttackCard.module.css';

export type AttackResult = { steps: StepResult[] } | { error: string };

function toneFor(text: string): Outcome {
    if (text.startsWith('SETTLED')) return 'SETTLED';
    if (text.startsWith('DUPLICATE')) return 'DUPLICATE_DROPPED';
    if (text.startsWith('REJECTED')) return 'REJECTED';
    return 'INVALID';
}

const columns: Column<StepResult>[] = [
    { header: 'Step', render: (s) => s.label },
    { header: 'Expected', render: (s) => <Badge tone={toneFor(s.expected)}>{s.expected}</Badge> },
    { header: 'Server said', render: (s) => <Badge tone={toneFor(s.actual)}>{s.actual}</Badge> },
    { header: 'Match', render: (s) => (s.ok ? '✓' : '✗') },
];

interface Props {
    attack: Attack;
    result: AttackResult | undefined;
    running: boolean;
    disabled: boolean;
    onRun: () => void;
}

export function AttackCard({ attack, result, running, disabled, onRun }: Props) {
    return (
        <Card title={attack.title}>
            {attack.movesMoney && (
                <div className={styles.meta}>
                    <Badge tone="DUPLICATE_DROPPED">moves money</Badge>
                </div>
            )}

            <h3 className={styles.label}>What the attacker does</h3>
            <p className={styles.text}>{attack.story}</p>

            <h3 className={styles.label}>What stops them</h3>
            <p className={styles.text}>{attack.defence}</p>

            <div className={styles.actions}>
                <Button onClick={onRun} disabled={disabled || running}>
                    {running ? 'Running…' : 'Run attack'}
                </Button>
            </div>

            {result && 'error' in result && <div className={styles.error}>{result.error}</div>}

            {result && 'steps' in result && (
                <>
                    <Table columns={columns} rows={result.steps} rowKey={(s) => s.label} />
                    {result.steps.every((s) => s.ok) ? (
                        <p className={styles.verdictOk}>Server behaved as expected.</p>
                    ) : (
                        <p className={styles.verdictBad}>Unexpected result. Check the Server said column.</p>
                    )}
                </>
            )}
        </Card>
    );
}