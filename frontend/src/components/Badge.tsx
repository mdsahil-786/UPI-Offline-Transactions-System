import type { Outcome } from '../api/types';
import styles from './Badge.module.css';

type Tone = Outcome | 'online' | 'offline';

interface Props {
    tone: Tone;
    children?: React.ReactNode;
}

const TONE_CLASS: Record<Tone, string> = {
    SETTLED: styles.settled,
    DUPLICATE_DROPPED: styles.duplicate,
    INVALID: styles.invalid,
    REJECTED: styles.invalid,
    online: styles.online,
    offline: styles.offline,
};

/**
 * Colour-coded pill. Pass an outcome (SETTLED, DUPLICATE_DROPPED, INVALID,
 * REJECTED) or 'online'/'offline' for mesh devices. With no children it
 * shows the tone text itself.
 */
export function Badge({ tone, children }: Props) {
    return (
        <span className={`${styles.badge} ${TONE_CLASS[tone]}`}>{children ?? tone}</span>
    );
}