import { Bar, BarChart, CartesianGrid, Cell, ErrorBar, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AlgorithmSummary, Stat } from '../../api/types';
import styles from './Experiments.module.css';

export const ALGORITHM_COLORS: Record<string, string> = {
    DIRECT: '#8b949e',
    EPIDEMIC: '#f85149',
    SPRAY_AND_WAIT: '#58a6ff',
    PROPHET: '#d29922',
};

const AXIS = '#8b949e';
const GRID = '#30363d';
const UNIT_DOMAIN: [number, number] = [0, 1];
const OPEN_DOMAIN: [number, 'auto'] = [0, 'auto'];

interface Props {
    subtitle: string;
    algorithms: AlgorithmSummary[];
    pick: (a: AlgorithmSummary) => Stat;
    digits?: number;
    unitScale?: boolean; // y axis fixed to 0..1
}

/** One bar per algorithm: the mean, with a 95% confidence interval as the error bar. */
export function MetricChart({ subtitle, algorithms, pick, digits = 2, unitScale = false }: Props) {
    const data = algorithms.map((a) => {
        const s = pick(a);
        return { name: a.algorithm, mean: s.mean ?? 0, ci: s.ci95 ?? 0 };
    });

    return (
        <div className={styles.chartCell}>
            <p className={styles.sub}>{subtitle}</p>
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="name"
                        stroke={AXIS}
                        tick={{ fill: AXIS, fontSize: 11 }}
                        tickFormatter={(v: string) => v.replace('SPRAY_AND_WAIT', 'SPRAY&WAIT')}
                    />
                    <YAxis stroke={AXIS} tick={{ fill: AXIS, fontSize: 11 }} domain={unitScale ? UNIT_DOMAIN : OPEN_DOMAIN} />
                    <Tooltip
                        contentStyle={{ background: '#161b22', border: '1px solid #30363d', color: '#e6edf3' }}
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        formatter={(value) => (typeof value === 'number' ? value.toFixed(digits) : String(value))}
                    />
                    <Bar dataKey="mean" name="mean" isAnimationActive={false}>
                        {data.map((d) => (
                            <Cell key={d.name} fill={ALGORITHM_COLORS[d.name] ?? '#58a6ff'} />
                        ))}
                        <ErrorBar dataKey="ci" stroke="#e6edf3" strokeWidth={2} width={6} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}