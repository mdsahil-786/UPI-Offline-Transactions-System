import type { ExperimentResult, SweepResult } from '../../api/types';
const cell = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v));

/** One row per algorithm and run. Runs with the same index share the same simulated world. */
export function runsToCsv(result: ExperimentResult): string {
    const lines = [
        'algorithm,run,generated,delivered,delivery_ratio,mean_latency_s,mean_hops,transmissions,overhead_ratio',
    ];
    for (const a of result.algorithms) {
        for (const r of a.runs) {
            lines.push(
                [
                    a.algorithm,
                    r.run,
                    r.generated,
                    r.delivered,
                    r.deliveryRatio,
                    r.meanLatencySeconds,
                    r.meanHops,
                    r.transmissions,
                    r.overheadRatio,
                ]
                    .map(cell)
                    .join(','),
            );
        }
    }
    return lines.join('\n');
}

const METRICS = [
    ['delivery_ratio', 'deliveryRatio'],
    ['latency_s', 'latencySeconds'],
    ['overhead_ratio', 'overheadRatio'],
    ['hops', 'hops'],
    ['transmissions', 'transmissions'],
] as const;

/** One row per algorithm and metric: mean, standard deviation, 95% CI half-width, n. */
export function summaryToCsv(result: ExperimentResult): string {
    const lines = ['algorithm,metric,mean,std,ci95,n'];
    for (const a of result.algorithms) {
        for (const [label, key] of METRICS) {
            const s = a[key];
            lines.push([a.algorithm, label, s.mean, s.std, s.ci95, s.n].map(cell).join(','));
        }
    }
    return lines.join('\n');
}

export function downloadText(filename: string, text: string, mime: string) {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** Long format: one row per sweep value, algorithm and run. Ready for a spreadsheet or pandas. */
export function sweepToCsv(sweep: SweepResult): string {
    const lines = [
        'parameter,value,algorithm,run,generated,delivered,delivery_ratio,mean_latency_s,mean_hops,transmissions,overhead_ratio',
    ];
    sweep.points.forEach((point, i) => {
        for (const a of point.algorithms) {
            for (const r of a.runs) {
                lines.push(
                    [
                        sweep.parameter,
                        sweep.values[i],
                        a.algorithm,
                        r.run,
                        r.generated,
                        r.delivered,
                        r.deliveryRatio,
                        r.meanLatencySeconds,
                        r.meanHops,
                        r.transmissions,
                        r.overheadRatio,
                    ]
                        .map(cell)
                        .join(','),
                );
            }
        }
    });
    return lines.join('\n') + '\n';
}