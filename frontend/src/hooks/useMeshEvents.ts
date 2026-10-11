import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SERVER_NODE_ID, subscribeEvents } from '../api/events';
import type { ConnectionStatus, MeshEvent, PipelineStage } from '../api/events';
import type { IngestOutcome } from '../api/types';
import { ACCOUNTS_KEY } from './useAccounts';
import { MESH_STATE_KEY } from './useMeshState';
import { TRANSACTIONS_KEY } from './useTransactions';

export interface Run {
    ingestId: string;
    bridgeNodeId: string;
    packetId: string;
    startedAt: number;
    stages: Partial<Record<PipelineStage, { status: 'PASS' | 'FAIL'; detail: string }>>;
    outcome?: IngestOutcome;
    reason?: string;
}

/** A packet in flight between two nodes (used by the mesh graph). */
export interface Flight {
    key: number;
    from: string;
    to: string;
    packetId: string;
    kind: 'hop' | 'upload';
}

export interface LogLine {
    key: number;
    ts: number;
    text: string;
}

const PLAYBACK_INTERVAL_MS = 220;
const FLIGHT_MS = 1400;
const MAX_RUNS = 12;
const MAX_LOG = 40;

export function useMeshEvents() {
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<ConnectionStatus>('connecting');
    const [runs, setRuns] = useState<Run[]>([]);
    const [flights, setFlights] = useState<Flight[]>([]);
    const [log, setLog] = useState<LogLine[]>([]);

    const queue = useRef<MeshEvent[]>([]);
    const counter = useRef(0);

    // Collect events as they arrive.
    useEffect(() => subscribeEvents((event) => queue.current.push(event), setStatus), []);

    // Play them back at a human pace.
    useEffect(() => {
        const invalidate = (...keys: (readonly unknown[])[]) =>
            keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));

        const pushLog = (ts: number, text: string) => {
            const key = ++counter.current;
            setLog((prev) => [{ key, ts, text }, ...prev].slice(0, MAX_LOG));
        };

        const addFlight = (flight: Omit<Flight, 'key'>) => {
            const key = ++counter.current;
            setFlights((prev) => [...prev, { ...flight, key }]);
            setTimeout(() => setFlights((prev) => prev.filter((f) => f.key !== key)), FLIGHT_MS);
        };

        const apply = (e: MeshEvent) => {
            switch (e.type) {
                case 'reset':
                    setRuns([]);
                    setFlights([]);
                    pushLog(e.ts, 'Mesh and idempotency cache cleared');
                    invalidate(MESH_STATE_KEY);
                    break;

                case 'inject':
                    pushLog(e.ts, `Packet ${e.packetId} injected at ${e.deviceId} (ttl ${e.ttl})`);
                    invalidate(MESH_STATE_KEY);
                    break;

                case 'transfer':
                    addFlight({ from: e.from, to: e.to, packetId: e.packetId, kind: 'hop' });
                    pushLog(e.ts, `${e.from} → ${e.to}: packet ${e.packetId} (ttl ${e.ttl})`);
                    invalidate(MESH_STATE_KEY);
                    break;

                case 'gossip':
                    pushLog(e.ts, `Gossip round finished: ${e.transfers} transfer(s)`);
                    break;

                case 'ingest-start':
                    setRuns((prev) =>
                        [
                            {
                                ingestId: e.ingestId,
                                bridgeNodeId: e.bridgeNodeId,
                                packetId: e.packetId,
                                startedAt: e.ts,
                                stages: {},
                            },
                            ...prev,
                        ].slice(0, MAX_RUNS),
                    );
                    addFlight({ from: e.bridgeNodeId, to: SERVER_NODE_ID, packetId: e.packetId, kind: 'upload' });
                    pushLog(e.ts, `${e.bridgeNodeId} uploads packet ${e.packetId} to the backend`);
                    break;

                case 'stage':
                    setRuns((prev) =>
                        prev.map((r) =>
                            r.ingestId === e.ingestId
                                ? { ...r, stages: { ...r.stages, [e.stage]: { status: e.status, detail: e.detail } } }
                                : r,
                        ),
                    );
                    break;

                case 'ingest-done':
                    setRuns((prev) =>
                        prev.map((r) =>
                            r.ingestId === e.ingestId ? { ...r, outcome: e.outcome, reason: e.reason } : r,
                        ),
                    );
                    pushLog(e.ts, `Packet result: ${e.outcome}${e.reason ? ` (${e.reason})` : ''}`);
                    invalidate(ACCOUNTS_KEY, TRANSACTIONS_KEY, MESH_STATE_KEY);
                    break;
            }
        };

        const timer = setInterval(() => {
            const pending = queue.current;
            if (pending.length === 0) return;
            const batch = pending.length > 30 ? 6 : pending.length > 12 ? 3 : 1; // catch up if far behind
            for (let i = 0; i < batch; i++) {
                const next = pending.shift();
                if (next) apply(next);
            }
        }, PLAYBACK_INTERVAL_MS);

        return () => clearInterval(timer);
    }, [queryClient]);

    return { status, runs, flights, log };
}