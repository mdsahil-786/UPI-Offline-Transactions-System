import { api } from './client';
import type { IngestResult, MeshPacket } from './types';

/** POST /api/bridge/ingest: what a real bridge phone does when it gets internet */
export const ingestPacket = (
    packet: MeshPacket,
    bridgeNodeId = 'security-lab',
    hopCount = 1,
) =>
    api.post<IngestResult>('/api/bridge/ingest', packet, {
        'X-Bridge-Node-Id': bridgeNodeId,
        'X-Hop-Count': String(hopCount),
    });