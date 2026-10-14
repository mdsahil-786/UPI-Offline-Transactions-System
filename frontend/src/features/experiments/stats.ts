import type { RunMetrics } from '../../api/types';

// Two-sided 95% critical values of Student's t for 1..30 degrees of freedom
const T95 = [
    12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131,
    2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];

export function tCritical(df: number): number {
    if (df <= 30) return T95[Math.max(df, 1) - 1];
    return df <= 120 ? 2.0 : 1.96;
}

export interface PairedStat {
    mean: number; // mean of (a − b) over the paired runs
    ci95: number; // half-width of the 95% confidence interval
    n: number; // number of pairs used
    significant: boolean; // the interval excludes zero
}

/**
 * Runs with the same index share the same simulated world for every algorithm, so a − b is
 * measured on identical worlds. Pairs where either value is missing are skipped.
 */
export function pairedDifference(
    a: RunMetrics[],
    b: RunMetrics[],
    pick: (r: RunMetrics) => number | null,
): PairedStat | null {
    const diffs: number[] = [];
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const x = pick(a[i]);
        const y = pick(b[i]);
        if (x !== null && y !== null) diffs.push(x - y);
    }
    const n = diffs.length;
    if (n < 2) return null;
    const mean = diffs.reduce((s, d) => s + d, 0) / n;
    const variance = diffs.reduce((s, d) => s + (d - mean) * (d - mean), 0) / (n - 1);
    const ci95 = tCritical(n - 1) * Math.sqrt(variance / n);
    return { mean, ci95, n, significant: Math.abs(mean) > ci95 };
}