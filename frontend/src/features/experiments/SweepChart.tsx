import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AlgorithmSummary, Stat, SweepResult } from '../../api/types';
import { ALGORITHM_COLORS } from './ResultCharts';

const AXIS = '#8b949e';
const GRID = '#30363d';
const UNIT_DOMAIN: [number, number] = [0, 1];
const OPEN_DOMAIN: [number, 'auto'] = [0, 'auto'];

type Row = { x: number } & Record<string, number | null>;

interface Props {
    sweep: SweepResult;
    xLabel: string;
    pick: (a: AlgorithmSummary) => Stat;
    digits: number;
    unitScale?: boolean; // y axis fixed to 0..1
}

function buildRows(sweep: SweepResult, pick: (a: AlgorithmSummary) => Stat, unitScale: boolean): Row[] {
    return sweep.values.map((x, i) => {
        const row: Row = { x };
        for (const a of sweep.points[i].algorithms) {
            const s = pick(a);
            if (s.mean === null) {
                row[a.algorithm] = null;
                row[`${a.algorithm}__low`] = null;
                row[`${a.algorithm}__band`] = null;
                row[`${a.algorithm}__ci`] = null;
                continue;
            }
            const ci = s.ci95 ?? 0;
            const low = Math.max(0, s.mean - ci);
            const high = unitScale ? Math.min(1, s.mean + ci) : s.mean + ci;
            row[a.algorithm] = s.mean;
            row[`${a.algorithm}__low`] = low;
            row[`${a.algorithm}__band`] = Math.max(0, high - low);
            row[`${a.algorithm}__ci`] = ci;
        }
        return row;
    });
}

export function SweepChart({ sweep, xLabel, pick, digits, unitScale = false }: Props) {
    const rows = buildRows(sweep, pick, unitScale);
    const names = sweep.points[0].algorithms.map((a) => a.algorithm);

    return (
        <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={rows} margin={{ top: 8, right: 24, left: 0, bottom: 24 }}>
                <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                <XAxis
                    dataKey="x"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    ticks={sweep.values}
                    stroke={AXIS}
                    tick={{ fill: AXIS, fontSize: 11 }}
                    label={{ value: xLabel, position: 'insideBottom', offset: -12, fill: AXIS, fontSize: 12 }}
                />
                <YAxis stroke={AXIS} tick={{ fill: AXIS, fontSize: 11 }} domain={unitScale ? UNIT_DOMAIN : OPEN_DOMAIN} />
                <Tooltip
                    contentStyle={{ background: '#161b22', border: '1px solid #30363d', color: '#e6edf3' }}
                    labelFormatter={(v) => `${xLabel}: ${v}`}
                    formatter={(value, _name, item) => {
                        const row = item.payload as Row | undefined;
                        const ci = row ? row[`${String(item.dataKey)}__ci`] : null;
                        const text = typeof value === 'number' ? value.toFixed(digits) : String(value);
                        return ci !== null && ci !== undefined ? `${text} ± ${ci.toFixed(digits)}` : text;
                    }}
                />
                <Legend verticalAlign="top" height={28} />

                {names.flatMap((name) => [
                    <Area
                        key={`${name}-low`}
                        dataKey={`${name}__low`}
                        stackId={name}
                        stroke="none"
                        fill="none"
                        legendType="none"
                        tooltipType="none"
                        isAnimationActive={false}
                    />,
                    <Area
                        key={`${name}-band`}
                        dataKey={`${name}__band`}
                        stackId={name}
                        stroke="none"
                        fill={ALGORITHM_COLORS[name] ?? '#58a6ff'}
                        fillOpacity={0.15}
                        legendType="none"
                        tooltipType="none"
                        isAnimationActive={false}
                    />,
                ])}

                {names.map((name) => (
                    <Line
                        key={name}
                        dataKey={name}
                        name={name.replace('SPRAY_AND_WAIT', 'SPRAY&WAIT')}
                        stroke={ALGORITHM_COLORS[name] ?? '#58a6ff'}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        isAnimationActive={false}
                    />
                ))}
            </ComposedChart>
        </ResponsiveContainer>
    );
}