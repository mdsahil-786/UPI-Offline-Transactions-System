import { SERVER_NODE_ID } from '../../api/events';
import type { MeshDevice } from '../../api/types';
import type { Flight } from '../../hooks/useMeshEvents';
import styles from './MeshGraph.module.css';

interface Point {
    x: number;
    y: number;
}

const WIDTH = 640;
const HEIGHT = 380;
const SERVER: Point = { x: 570, y: 70 };
// Where uploads from bridges we don't draw (e.g. the Security Lab) appear to come from.
const OUTSIDE: Point = { x: 590, y: 330 };

const KNOWN: Record<string, Point> = {
    'phone-alice': { x: 70, y: 250 },
    'phone-stranger1': { x: 180, y: 90 },
    'phone-stranger2': { x: 200, y: 320 },
    'phone-stranger3': { x: 330, y: 190 },
    'phone-bridge': { x: 470, y: 200 },
};

/** Fixed positions for the known phones, a circle for any others. */
function layout(devices: MeshDevice[]): Record<string, Point> {
    const points: Record<string, Point> = {};
    const unknown = devices.filter((d) => !KNOWN[d.deviceId]);
    for (const d of devices) {
        if (KNOWN[d.deviceId]) points[d.deviceId] = KNOWN[d.deviceId];
    }
    unknown.forEach((d, i) => {
        const angle = (2 * Math.PI * i) / unknown.length;
        points[d.deviceId] = { x: 330 + 120 * Math.cos(angle), y: 190 + 120 * Math.sin(angle) };
    });
    return points;
}

interface Props {
    devices: MeshDevice[];
    flights: Flight[];
}

export function MeshGraph({ devices, flights }: Props) {
    const points = layout(devices);
    const receiving = new Set(flights.map((f) => f.to));
    const serverActive = receiving.has(SERVER_NODE_ID);

    // Everyone in the demo is "in range" of everyone else.
    const links: [MeshDevice, MeshDevice][] = [];
    for (let i = 0; i < devices.length; i++) {
        for (let j = i + 1; j < devices.length; j++) links.push([devices[i], devices[j]]);
    }

    return (
        <div>
            <svg
                className={styles.svg}
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                role="img"
                aria-label="Phones in the mesh and the backend"
            >
                {links.map(([a, b]) => (
                    <line
                        key={`${a.deviceId}-${b.deviceId}`}
                        className={styles.link}
                        x1={points[a.deviceId].x}
                        y1={points[a.deviceId].y}
                        x2={points[b.deviceId].x}
                        y2={points[b.deviceId].y}
                    />
                ))}

                {devices
                    .filter((d) => d.hasInternet)
                    .map((d) => (
                        <line
                            key={`uplink-${d.deviceId}`}
                            className={styles.uplink}
                            x1={points[d.deviceId].x}
                            y1={points[d.deviceId].y}
                            x2={SERVER.x}
                            y2={SERVER.y}
                        />
                    ))}

                <rect
                    className={serverActive ? styles.serverActive : styles.server}
                    x={SERVER.x - 52}
                    y={SERVER.y - 24}
                    width={104}
                    height={48}
                    rx={8}
                />
                <text className={styles.serverLabel} x={SERVER.x} y={SERVER.y}>
                    Backend
                </text>

                {devices.map((d) => {
                    const p = points[d.deviceId];
                    const cls = d.hasInternet
                        ? styles.nodeBridge
                        : d.packetCount > 0
                            ? `${styles.node} ${styles.nodeHolding}`
                            : styles.node;
                    return (
                        <g key={d.deviceId}>
                            {receiving.has(d.deviceId) && <circle className={styles.pulse} cx={p.x} cy={p.y} r={26} />}
                            <circle className={cls} cx={p.x} cy={p.y} r={26} />
                            <text className={styles.count} x={p.x} y={p.y}>
                                {d.packetCount}
                            </text>
                            <text className={styles.label} x={p.x} y={p.y + 44}>
                                {d.deviceId.replace(/^phone-/, '')}
                            </text>
                        </g>
                    );
                })}

                {flights.map((f) => {
                    const from = points[f.from] ?? (f.kind === 'upload' ? OUTSIDE : undefined);
                    const to = f.to === SERVER_NODE_ID ? SERVER : points[f.to];
                    if (!from || !to) return null;
                    return (
                        <circle
                            key={f.key}
                            className={f.kind === 'upload' ? styles.packetUpload : styles.packet}
                            r={7}
                            cx={from.x}
                            cy={from.y}
                        >
                            <animate attributeName="cx" from={from.x} to={to.x} dur="0.9s" fill="freeze" />
                            <animate attributeName="cy" from={from.y} to={to.y} dur="0.9s" fill="freeze" />
                        </circle>
                    );
                })}
            </svg>

            <div className={styles.legend}>
        <span>
          <span className={styles.key} style={{ background: 'var(--color-online)' }} />
          phone with 4G
        </span>
                <span>
          <span className={styles.key} style={{ background: 'var(--color-border)' }} />
          offline phone (number = packets held)
        </span>
                <span>
          <span className={styles.key} style={{ background: 'var(--color-accent)' }} />
          packet hopping
        </span>
                <span>
          <span className={styles.key} style={{ background: 'var(--color-settled)' }} />
          packet uploading
        </span>
            </div>
        </div>
    );
}