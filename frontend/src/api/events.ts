import type { IngestOutcome } from './types';

export type PipelineStage = 'HASH' | 'CLAIM' | 'DECRYPT' | 'VERIFY' | 'FRESHNESS' | 'SETTLE';

export const PIPELINE_STAGES: PipelineStage[] = [
    'HASH',
    'CLAIM',
    'DECRYPT',
    'VERIFY',
    'FRESHNESS',
    'SETTLE',
];

/** Id used for the backend when a packet is drawn flying from a bridge to the server. */
export const SERVER_NODE_ID = 'backend';

/** Mirrors the events published by EventBus on the Java side. */
export type MeshEvent =
    | { type: 'reset'; ts: number }
    | { type: 'inject'; ts: number; deviceId: string; packetId: string; ttl: number }
    | { type: 'transfer'; ts: number; from: string; to: string; packetId: string; ttl: number }
    | { type: 'gossip'; ts: number; transfers: number }
    | {
    type: 'ingest-start';
    ts: number;
    ingestId: string;
    bridgeNodeId: string;
    packetId: string;
    hops: number;
}
    | {
    type: 'stage';
    ts: number;
    ingestId: string;
    stage: PipelineStage;
    status: 'PASS' | 'FAIL';
    detail: string;
}
    | { type: 'ingest-done'; ts: number; ingestId: string; outcome: IngestOutcome; reason: string };

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting';

/**
 * Open the server-sent event stream. The browser reconnects by itself if the
 * connection drops. Returns a function that closes the stream.
 */
export function subscribeEvents(
    onEvent: (event: MeshEvent) => void,
    onStatus: (status: ConnectionStatus) => void,
): () => void {
    const source = new EventSource('/api/events');

    source.onopen = () => onStatus('live');
    source.onerror = () => onStatus('reconnecting');
    source.onmessage = (message) => {
        try {
            const parsed = JSON.parse(message.data) as MeshEvent;
            if (parsed && typeof parsed.type === 'string') onEvent(parsed);
        } catch {
            // ignore anything that is not one of our JSON events
        }
    };

    return () => source.close();
}
